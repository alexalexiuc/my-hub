import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AuthInfo, JSONRPCMessage } from '@modelcontextprotocol/server';
import { putLog, PutLogData } from '@my-hub/shared/services';
import { envConfig } from '../config/env.js';
import { getHubAuthExtra } from '../shared/toolsUtils.js';
import { capPayload, redactSensitiveFields } from './payload-logging.js';
import { isMcpEndpoint } from '../utils/mcp-endpoint.js';
import { isJSONRPCCallable, isJSONRPCErrorResponse, isJSONRPCResultResponse } from '../utils/jsonrpc.js';

// Methods whose full JSON payload is protocol boilerplate — identical across every client.
const BOILERPLATE_METHODS = new Set(['server/discover']);

/** Response bodies above this size are not buffered for inspection (tool results are far smaller). */
const MAX_CAPTURED_RESPONSE_BYTES = 1_048_576;

type McpLogData = Omit<PutLogData, 'durationMs' | 'statusCode'>;

/** Extracts the JSON-RPC response message from a JSON or SSE response body. */
export function parseMcpResponse(contentType: string | undefined, body: string): JSONRPCMessage | null {
  if (!body) return null;
  try {
    if (contentType?.includes('text/event-stream')) {
      // The terminal result is the last `data:` frame; earlier frames are notifications.
      const frames = body
        .split('\n')
        .filter(line => line.startsWith('data:'))
        .map(line => JSON.parse(line.slice(5).trim()) as JSONRPCMessage);
      return frames.findLast(frame => isJSONRPCResultResponse(frame) || isJSONRPCErrorResponse(frame)) ?? null;
    }
    return JSON.parse(body) as JSONRPCMessage;
  } catch {
    return null;
  }
}

/**
 * Status recorded for an MCP exchange: the HTTP status when the request was rejected (auth, headers, protocol
 * version), 400 for a JSON-RPC error response, 422 for a tool result flagged `isError`, otherwise 200.
 */
function resolveOutcome(
  httpStatus: number,
  response: JSONRPCMessage | null,
): { statusCode: number; error: string | null } {
  if (isJSONRPCErrorResponse(response)) {
    return { statusCode: httpStatus >= 400 ? httpStatus : 400, error: response.error.message };
  }
  if (httpStatus >= 400) return { statusCode: httpStatus, error: null };
  if (isJSONRPCResultResponse(response) && response.result.isError === true) {
    const { content } = response.result as { content?: Array<{ type: string; text?: string }> };
    return { statusCode: 422, error: content?.find(c => c.type === 'text')?.text ?? null };
  }
  return { statusCode: httpStatus, error: null };
}

/** Buffers what the MCP handler writes to the raw response so the result can be inspected once it is sent. */
function captureResponseBody(reply: FastifyReply): () => string {
  const { raw } = reply;
  const chunks: Buffer[] = [];
  let size = 0;
  const collect = (chunk: unknown, encoding?: unknown) => {
    if (chunk == null || typeof chunk === 'function' || size > MAX_CAPTURED_RESPONSE_BYTES) return;
    const buf = Buffer.isBuffer(chunk)
      ? chunk
      : chunk instanceof Uint8Array
        ? Buffer.from(chunk)
        : Buffer.from(String(chunk), typeof encoding === 'string' ? (encoding as BufferEncoding) : 'utf8');
    size += buf.length;
    chunks.push(buf);
  };

  const originalWrite = raw.write.bind(raw) as (...args: unknown[]) => boolean;
  const originalEnd = raw.end.bind(raw) as (...args: unknown[]) => typeof raw;
  raw.write = ((chunk: unknown, ...rest: unknown[]) => {
    collect(chunk, rest[0]);
    return originalWrite(chunk, ...rest);
  }) as typeof raw.write;
  raw.end = ((chunk?: unknown, ...rest: unknown[]) => {
    collect(chunk, rest[0]);
    return originalEnd(chunk, ...rest);
  }) as typeof raw.end;

  return () => (size > MAX_CAPTURED_RESPONSE_BYTES ? '' : Buffer.concat(chunks).toString('utf8'));
}

function buildLogData(req: FastifyRequest, message: JSONRPCMessage | null): McpLogData & { label: string } {
  const endpoint = req.routeOptions.url ?? req.url;
  const method = message && isJSONRPCCallable(message) ? message.method : req.method;
  const toolName =
    message && isJSONRPCCallable(message) && method === 'tools/call'
      ? (message.params?.name as string | undefined)
      : undefined;

  // Verified auth is attached to the raw request by fastify-mcp-server's bearer preHandler.
  const {
    userId = null,
    clientId = null,
    serverName = null,
  } = getHubAuthExtra((req.raw as { auth?: AuthInfo }).auth) || {};

  return {
    label: `MCP ${method}${toolName ? ` (${toolName})` : ''}`,
    service: 'mcp-service',
    server: serverName,
    method,
    path: toolName ? `${endpoint}#${toolName}` : endpoint,
    ip: req.ip || null,
    userId,
    clientId,
  };
}

/**
 * Logs every MCP Streamable HTTP exchange (console + DB). Under MCP 2026-07-28 each HTTP request carries
 * exactly one JSON-RPC message and its response, so one exchange is one log entry with its duration and outcome.
 * Must be registered before the MCP sub-servers so its hooks apply to their routes.
 */
export const mcpRequestLoggerPlugin = fp(
  async (app: FastifyInstance) => {
    app.addHook('onRequest', async (req, reply) => {
      if (!isMcpEndpoint(req.url)) return;

      const readResponseBody = captureResponseBody(reply);

      reply.raw.once('close', () => {
        const message = (req.body ?? null) as JSONRPCMessage | null;
        const { label, ...logData } = buildLogData(req, message);
        const durationMs = Math.round(reply.elapsedTime);
        const response = parseMcpResponse(reply.raw.getHeader('content-type')?.toString(), readResponseBody());
        const { statusCode, error } = resolveOutcome(reply.raw.statusCode, response);
        const responseBody = isJSONRPCResultResponse(response)
          ? response.result
          : isJSONRPCErrorResponse(response)
            ? response.error
            : null;

        const logFn = statusCode >= 400 ? app.log.warn.bind(app.log) : app.log.info.bind(app.log);
        logFn(`<-- ${label} ${statusCode} ${durationMs}ms`);
        if (envConfig.PRINT_PAYLOADS && !BOILERPLATE_METHODS.has(logData.method)) {
          logFn(`\tMCP Message: ${JSON.stringify(capPayload(redactSensitiveFields(message)), null, 2)}`);
          logFn(`\tMCP Response: ${JSON.stringify(capPayload(redactSensitiveFields(responseBody)), null, 2)}`);
        }

        const entry: PutLogData = { ...logData, durationMs, statusCode, error };
        if (envConfig.LOG_PAYLOADS) {
          entry.requestBody = capPayload(redactSensitiveFields(message));
          entry.responseBody = capPayload(redactSensitiveFields(responseBody));
        }

        putLog(entry).catch((err: unknown) => {
          app.log.error({ err }, 'Failed to write MCP request log to DB');
        });
      });
    });
  },
  { name: 'mcp-request-logger' },
);
