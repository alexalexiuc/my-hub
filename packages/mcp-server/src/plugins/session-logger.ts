import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { MessageExtraInfo } from '@modelcontextprotocol/sdk/types.js';
import { putLog } from '@my-hub/shared/services';
import type { McpServerName } from '@my-hub/shared/schema';
import { envConfig } from '../config/env.js';
import { mcpSubServers } from '../mcp/registry.js';
import { capPayload, redactSensitiveFields } from './payload-logging.js';

function extractMessageInfo(message: JSONRPCMessage): { method: string; toolName?: string } | null {
  if (!('method' in message)) return null; // skip responses

  const method = message.method;
  const params = 'params' in message ? (message.params as Record<string, unknown> | undefined) : undefined;
  const toolName = method === 'tools/call' ? (params?.['name'] as string | undefined) : undefined;

  return { method, toolName };
}

function logSessionMessage(
  app: FastifyInstance,
  sessionId: string,
  endpoint: string,
  message: JSONRPCMessage,
  extra: MessageExtraInfo | undefined,
): void {
  const info = extractMessageInfo(message);
  if (!info) return;

  const { method, toolName } = info;
  const authInfo = extra?.authInfo;
  const userId = (authInfo?.extra?.['userId'] as string | undefined) ?? null;
  const clientId = (authInfo?.extra?.['clientId'] as string | undefined) ?? null;
  const serverName = (authInfo?.extra?.['serverName'] as McpServerName | undefined) ?? null;
  const redactedMessage = redactSensitiveFields(message);

  console.log(`--> MCP ${method}${toolName ? ` (${toolName})` : ''} [session:${sessionId.slice(0, 8)}]`);
  if (envConfig.PRINT_PAYLOADS) {
    console.log(`\tMCP Message: ${JSON.stringify(capPayload(redactedMessage), null, 2)}`);
  }

  const path = toolName ? `${endpoint}#${toolName}` : endpoint;

  const logData: Parameters<typeof putLog>[0] = {
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

        const originalOnMessage = transport.onmessage;
        transport.onmessage = (message: JSONRPCMessage, extra?: MessageExtraInfo) => {
          logSessionMessage(app, sessionId, endpoint, message, extra);
          originalOnMessage?.(message, extra);
        };
      });
    }
  });
});
