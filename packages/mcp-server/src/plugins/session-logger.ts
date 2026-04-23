import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { MessageExtraInfo } from '@modelcontextprotocol/sdk/types.js';
import { putLog, PutLogData } from '@my-hub/shared/services';
import { envConfig } from '../config/env.js';
import { mcpSubServers } from '../mcp/registry.js';
import { getHubAuthExtra } from '../shared/toolsUtils.js';
import { capPayload, redactSensitiveFields } from './payload-logging.js';

// Methods whose full JSON payload is protocol boilerplate — identical across every session.
const HANDSHAKE_METHODS = new Set(['initialize', 'notifications/initialized']);

function extractMessageInfo(message: JSONRPCMessage): { method: string; toolName?: string } | null {
  if (!('method' in message)) return null; // skip responses

  const { method } = message;
  const params = 'params' in message ? (message.params as Record<string, unknown> | undefined) : undefined;
  const toolName = method === 'tools/call' ? (params?.name as string | undefined) : undefined;

  return { method, toolName };
}

function logSessionMessage(
  app: FastifyInstance,
  sessionId: string,
  endpoint: string,
  message: JSONRPCMessage,
  extra?: MessageExtraInfo,
): void {
  const info = extractMessageInfo(message);
  if (!info) return;

  const { method, toolName } = info;
  const { userId = null, clientId = null, serverName = null } = getHubAuthExtra(extra) || {};
  const redactedMessage = redactSensitiveFields(message);

  app.log.info(`--> MCP ${method}${toolName ? ` (${toolName})` : ''} [session:${sessionId.slice(0, 8)}]`);
  // Skip full payload for handshake messages — they are protocol boilerplate, identical every session.
  if (envConfig.PRINT_PAYLOADS && !HANDSHAKE_METHODS.has(method)) {
    app.log.info(`\tMCP Message: ${JSON.stringify(capPayload(redactedMessage), null, 2)}`);
  }

  const path = toolName ? `${endpoint}#${toolName}` : endpoint;

  const logData: PutLogData = {
    service: 'mcp-service',
    server: serverName,
    method,
    path,
    statusCode: null,
    durationMs: null,
    ip: null,
    userId,
    clientId,
  };

  if (envConfig.LOG_PAYLOADS) {
    logData.requestBody = capPayload(redactedMessage);
  }

  putLog(logData).catch((err: unknown) => {
    app.log.error({ err }, 'Failed to write MCP session message log to DB');
  });
}

export const sessionLoggerPlugin = fp(async (app: FastifyInstance) => {
  app.addHook('onReady', async () => {
    for (const { endpoint, sessionManager } of mcpSubServers) {
      sessionManager.on('sessionCreated', (sessionId: string) => {
        const transport = sessionManager.getTransport(sessionId);
        if (!transport) return;

        // Track pending tools/call requests by JSON-RPC id for response correlation.
        // Keyed by id so parallel tool calls within the same session are handled correctly.
        const pendingCalls = new Map<string | number, { toolName: string; startMs: number }>();

        const originalOnMessage = transport.onmessage;
        transport.onmessage = (message: JSONRPCMessage, extra?: MessageExtraInfo) => {
          logSessionMessage(app, sessionId, endpoint, message, extra);

          if ('method' in message && message.method === 'tools/call' && 'id' in message && message.id != null) {
            const params = 'params' in message ? (message.params as Record<string, unknown>) : undefined;
            const toolName = params?.name as string | undefined;
            if (toolName) {
              pendingCalls.set(message.id, { toolName, startMs: Date.now() });
            }
          }

          originalOnMessage?.(message, extra);
        };

        // Intercept outgoing messages to log tool call responses with duration.
        const originalSend = transport.send.bind(transport);
        transport.send = async (...args: Parameters<typeof originalSend>): Promise<void> => {
          const [message] = args;

          if ('id' in message && message.id != null && !('method' in message)) {
            const pending = pendingCalls.get(message.id);
            if (pending) {
              const durationMs = Date.now() - pending.startMs;
              const responseBody =
                'result' in message ? message.result : 'error' in message ? message.error : undefined;
              const isError =
                typeof responseBody === 'object' &&
                responseBody !== null &&
                (responseBody as Record<string, unknown>).isError === true;
              const logFn = isError ? app.log.warn.bind(app.log) : app.log.info.bind(app.log);
              logFn(`<-- MCP tools/call (${pending.toolName}) [session:${sessionId.slice(0, 8)}] ${durationMs}ms`);
              if (envConfig.PRINT_PAYLOADS) {
                logFn(
                  `\tMCP Response: ${JSON.stringify(capPayload(redactSensitiveFields(responseBody as Record<string, unknown>)), null, 2)}`,
                );
              }
              pendingCalls.delete(message.id);
            }
          }

          return originalSend(...args);
        };
      });
    }
  });
});
