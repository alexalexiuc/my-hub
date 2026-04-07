import type { FastifyInstance } from 'fastify';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import FastifyMcpServer, { getMcpDecorator } from 'fastify-mcp-server';
import type { McpServerName } from '@my-hub/shared/constants';
import { createHubTokenVerifier } from '../plugins/oauth-verifier.js';
import { mcpSubServers } from './registry.js';

/**
 * Registers an MCP sub-server in its own Fastify child scope.
 *
 * Each domain (calories, hive-manager, …) gets its own endpoint,
 * independent session manager, and bearer-auth verifier that also
 * checks the user exists and has the server enabled.
 *
 * Usage in server.ts:
 *   registerMcpSubServer(app, '/calories/mcp', 'calories', createCaloriesMcpServer);
 *   registerMcpSubServer(app, '/todo/mcp', 'todo', createTodoMcpServer);
 *
 * Multiple registrations are safe because each one runs in an isolated
 * Fastify child scope.
 */
export function registerMcpSubServer(
  app: FastifyInstance,
  endpoint: string,
  serverName: McpServerName,
  createMcpServer: () => McpServer,
): void {
  app.register(async (child) => {
    await child.register(FastifyMcpServer, {
      createMcpServer,
      endpoint,
      authorization: {
        bearerMiddlewareOptions: {
          verifier: createHubTokenVerifier(serverName),
        },
      },
    });

    const mcp = getMcpDecorator(child);
    mcpSubServers.push({ endpoint, sessionManager: mcp.getSessionManager() });
  });
  app.log.info(`Registered MCP sub-server "${serverName}" at endpoint "${endpoint}"`);
}
