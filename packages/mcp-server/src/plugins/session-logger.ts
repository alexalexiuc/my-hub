import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import type { JSONRPCMessage, MessageExtraInfo } from '@modelcontextprotocol/sdk/types.js';
import { putLog, PutLogData } from '@my-hub/shared/services';
import { envConfig } from '../config/env.js';
import { mcpSubServers } from '../mcp/registry.js';
import { getHubAuthExtra } from '../shared/toolsUtils.js';
import { capPayload, redactSensitiveFields } from './payload-logging.js';
import {
  isJSONRPCRequest,
  isJSONRPCCallable,
  isJSONRPCResultResponse,
  isJSONRPCErrorResponse,
  isJSONRPCAnyResponse,
} from '../utils/jsonrpc.js';

// Methods whose full JSON payload is protocol boilerplate — identical across every session.
const HANDSHAKE_METHODS = new Set(['initialize', 'notifications/initialized']);

function extractIp(extra?: MessageExtraInfo): string | null {
  const headers = extra?.requestInfo?.headers;
  if (!headers) return null;
  const forwarded = headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() ?? null;
  if (Array.isArray(forwarded)) return forwarded[0]?.split(',')[0]?.trim() ?? null;
  const realIp = headers['x-real-ip'];
  return typeof realIp === 'string' ? realIp.trim() : null;
}

/**
 * Logs the incoming MCP message to stdout and returns a partial PutLogData for DB logging.
 * Returns null for responses — callers handle those separately.
 * durationMs and statusCode are intentionally omitted; callers fill them in before writing.
 */
function buildSessionLogEntry(
  app: FastifyInstance,
  sessionId: string,
  endpoint: string,
  message: JSONRPCMessage,
  extra?: MessageExtraInfo,
): Omit<PutLogData, 'durationMs' | 'statusCode'> | null {
  if (!isJSONRPCCallable(message)) return null;

  const { method } = message;
  const toolName =
    isJSONRPCRequest(message) && method === 'tools/call' ? (message.params?.name as string | undefined) : undefined;

  const { userId = null, clientId = null, serverName = null } = getHubAuthExtra(extra) || {};
  const redactedMessage = redactSensitiveFields(message);

  app.log.info(`--> MCP ${method}${toolName ? ` (${toolName})` : ''} [session:${sessionId.slice(0, 8)}]`);
  if (envConfig.PRINT_PAYLOADS && !HANDSHAKE_METHODS.has(method)) {
    app.log.info(`\tMCP Message: ${JSON.stringify(capPayload(redactedMessage), null, 2)}`);
  }

  const logData: Omit<PutLogData, 'durationMs' | 'statusCode'> = {
    service: 'mcp-service',
    server: serverName,
    method,
    path: toolName ? `${endpoint}#${toolName}` : endpoint,
    ip: extractIp(extra),
    userId,
    clientId,
  };

  if (envConfig.LOG_PAYLOADS) {
    logData.requestBody = capPayload(redactedMessage);
  }

  return logData;
}

export const sessionLoggerPlugin = fp(async (app: FastifyInstance) => {
  app.addHook('onReady', async () => {
    for (const { endpoint, sessionManager } of mcpSubServers) {
      sessionManager.on('sessionCreated', (sessionId: string) => {
        const transport = sessionManager.getTransport(sessionId);
        if (!transport) return;

        // Track pending tools/call requests by JSON-RPC id for response correlation.
        // Keyed by id so parallel tool calls within the same session are handled correctly.
        const pendingCalls = new Map<
          string | number,
          { toolName: string; startMs: number; logData: Omit<PutLogData, 'durationMs' | 'statusCode'> }
        >();

        const originalOnMessage = transport.onmessage;
        transport.onmessage = (message: JSONRPCMessage, extra?: MessageExtraInfo) => {
          const logData = buildSessionLogEntry(app, sessionId, endpoint, message, extra);

          if (logData && isJSONRPCRequest(message) && message.method === 'tools/call') {
            // Defer DB write until transport.send fires with the response + duration.
            const toolName = message.params?.name as string | undefined;
            if (toolName && message.id != null) {
              pendingCalls.set(message.id, { toolName, startMs: Date.now(), logData });
            }
          } else if (logData) {
            // Non-tool-call messages have no meaningful duration — write immediately.
            putLog({ ...logData, durationMs: null, statusCode: null }).catch((err: unknown) => {
              app.log.error({ err }, 'Failed to write MCP session message log to DB');
            });
          }

          originalOnMessage?.(message, extra);
        };

        // Intercept outgoing messages to log tool call responses with duration and status.
        const originalSend = transport.send.bind(transport);
        transport.send = async (...args: Parameters<typeof originalSend>): Promise<void> => {
          const [message] = args;

          if (isJSONRPCAnyResponse(message) && message.id != null) {
            const pending = pendingCalls.get(message.id);
            if (pending) {
              const durationMs = Date.now() - pending.startMs;
              const isProtocolError = isJSONRPCErrorResponse(message);
              const responseBody = isJSONRPCResultResponse(message) ? message.result : message.error;
              const isToolResultError =
                !isProtocolError &&
                typeof responseBody === 'object' &&
                responseBody !== null &&
                (responseBody as Record<string, unknown>).isError === true;

              // 200 success / 422 tool error (ran but failed) / 400 protocol error
              const statusCode = isProtocolError ? 400 : isToolResultError ? 422 : 200;
              const logFn = statusCode !== 200 ? app.log.warn.bind(app.log) : app.log.info.bind(app.log);

              logFn(
                `<-- MCP tools/call (${pending.toolName}) [session:${sessionId.slice(0, 8)}] ${durationMs}ms ${statusCode}`,
              );
              if (envConfig.PRINT_PAYLOADS) {
                logFn(
                  `\tMCP Response: ${JSON.stringify(capPayload(redactSensitiveFields(responseBody as Record<string, unknown>)), null, 2)}`,
                );
              }

              let error: string | null = null;
              if (isProtocolError) {
                const { message: msg } = responseBody as Record<string, unknown>;
                error = typeof msg === 'string' ? msg : null;
              } else if (isToolResultError) {
                const { content } = responseBody as { content?: Array<{ type: string; text?: string }> };
                error = content?.find(c => c.type === 'text')?.text ?? null;
              }

              putLog({ ...pending.logData, durationMs, statusCode, error }).catch((err: unknown) => {
                app.log.error({ err }, 'Failed to write MCP tool call log to DB');
              });
              pendingCalls.delete(message.id);
            }
          }

          return originalSend(...args);
        };
      });
    }
  });
});
