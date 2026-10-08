import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { isCallToolResult, isJSONRPCErrorResponse, isJSONRPCResponse } from '@modelcontextprotocol/server';
import type { JSONRPCMessage } from '@modelcontextprotocol/server';
import { putLog, PutLogData } from '@my-hub/shared/services';
import { envConfig } from '../config/env.js';
import { getRequestHubAuthExtra } from '../shared/toolsUtils.js';
import { capPayload, redactSensitiveFields } from './payload-logging.js';
import { isJSONRPCCallable } from '../utils/jsonrpc.js';

// Methods whose full JSON payload is protocol boilerplate — identical across every client.
const BOILERPLATE_METHODS = new Set(['server/discover']);

/** Response bodies above this size are not buffered for inspection (tool results are far smaller). */
const MAX_CAPTURED_RESPONSE_BYTES = 1_048_576;

type Outcome = { statusCode: number; error: string | null; responseBody: unknown };

/** Extracts the JSON-RPC response message from a JSON or SSE response body. */
function parseMcpResponse(contentType: string | undefined, body: string): JSONRPCMessage | null {
  if (!body) return null;
  try {
    if (contentType?.includes('text/event-stream')) {
      // The terminal result is the last `data:` frame; earlier frames are notifications.
      const frames = body
        .split('\n')
        .filter(line => line.startsWith('data:'))
        .map(line => JSON.parse(line.slice(5).trim()) as JSONRPCMessage);
      return frames.findLast(isJSONRPCResponse) ?? null;
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
function resolveOutcome(httpStatus: number, response: JSONRPCMessage | null): Outcome {
  if (isJSONRPCErrorResponse(response)) {
    return {
      statusCode: httpStatus >= 400 ? httpStatus : 400,
      error: response.error.message,
      responseBody: response.error,
    };
  }
  const responseBody = isJSONRPCResponse(response) ? response.result : null;
  if (httpStatus >= 400) return { statusCode: httpStatus, error: null, responseBody };
  if (isCallToolResult(responseBody) && responseBody.isError === true) {
    const text = responseBody.content.find(c => c.type === 'text');
    return { statusCode: 422, error: text?.type === 'text' ? text.text : null, responseBody };
  }
  return { statusCode: httpStatus, error: null, responseBody };
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
        ? Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)
        : Buffer.from(String(chunk), typeof encoding === 'string' ? (encoding as BufferEncoding) : 'utf8');
    size += buf.length;
    // Over the cap the body is not inspected at all — release what was buffered so far.
    if (size > MAX_CAPTURED_RESPONSE_BYTES) chunks.length = 0;
    else chunks.push(buf);
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

  return () => Buffer.concat(chunks).toString('utf8');
}

/**
 * Logs every MCP Streamable HTTP exchange on `scope` (console + DB). Under MCP 2026-07-28 each HTTP request carries
 * exactly one JSON-RPC message and its response, so one exchange is one log entry with its duration and outcome.
 *
 * Call it on the sub-server's child scope before registering fastify-mcp-server, so the hooks cover its route.
 * The plugin hijacks the reply, so the outcome is read from what the handler writes to the raw response — buffered
 * only for tool calls (to tell a tool error from success) or when payloads are logged.
 */
export function attachMcpRequestLogger(scope: FastifyInstance, endpoint: string): void {
  const { LOG_PAYLOADS, PRINT_PAYLOADS } = envConfig;
  const readBodies = new WeakMap<FastifyRequest, () => string>();

  // App-level preHandler runs after body parsing and before the route's bearer-auth preHandler.
  scope.addHook('preHandler', async (req, reply) => {
    const message = req.body as JSONRPCMessage | null;
    const isToolCall = !!message && isJSONRPCCallable(message) && message.method === 'tools/call';
    if (isToolCall || LOG_PAYLOADS || PRINT_PAYLOADS) {
      readBodies.set(req, captureResponseBody(reply));
    }
  });

  scope.addHook('onRequest', async (req, reply) => {
    reply.raw.once('close', () => {
      const message = (req.body ?? null) as JSONRPCMessage | null;
      const call = message && isJSONRPCCallable(message) ? message : null;
      const method = call?.method ?? req.method;
      const toolName = call?.method === 'tools/call' ? (call.params?.name as string | undefined) : undefined;
      const label = `MCP ${method}${toolName ? ` (${toolName})` : ''}`;

      const durationMs = Math.round(reply.elapsedTime);
      const response = parseMcpResponse(reply.raw.getHeader('content-type')?.toString(), readBodies.get(req)?.() ?? '');
      const { statusCode, error, responseBody } = resolveOutcome(reply.raw.statusCode, response);
      const { userId = null, clientId = null, serverName = null } = getRequestHubAuthExtra(req) || {};

      const level = statusCode >= 400 ? 'warn' : 'info';
      scope.log[level](`<-- ${label} ${statusCode} ${durationMs}ms`);

      const entry: PutLogData = {
        service: 'mcp-service',
        server: serverName,
        method,
        path: toolName ? `${endpoint}#${toolName}` : endpoint,
        ip: req.ip || null,
        userId,
        clientId,
        durationMs,
        statusCode,
        error,
      };

      if (LOG_PAYLOADS || PRINT_PAYLOADS) {
        const requestPayload = capPayload(redactSensitiveFields(message));
        const responsePayload = capPayload(redactSensitiveFields(responseBody));
        if (PRINT_PAYLOADS && !BOILERPLATE_METHODS.has(method)) {
          scope.log[level](`\tMCP Message: ${JSON.stringify(requestPayload, null, 2)}`);
          scope.log[level](`\tMCP Response: ${JSON.stringify(responsePayload, null, 2)}`);
        }
        if (LOG_PAYLOADS) {
          entry.requestBody = requestPayload;
          entry.responseBody = responsePayload;
        }
      }

      putLog(entry).catch((err: unknown) => {
        scope.log.error({ err }, 'Failed to write MCP request log to DB');
      });
    });
  });
}
