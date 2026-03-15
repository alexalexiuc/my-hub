import type { FastifyInstance } from 'fastify';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import FastifyMcpServer, { getMcpDecorator } from 'fastify-mcp-server';
import { hubTokenVerifier } from '../plugins/oauth-verifier.js';
import { mcpSubServers } from './registry.js';

/**
 * Registers an MCP sub-server in its own Fastify child scope.
 *
 * Each domain (calories, hive-manager, …) gets its own endpoint,
 * independent session manager, and bearer-auth verifier.
 *
 * Usage in server.ts:
 *   registerMcpSubServer(app, '/mcp/calories', createCaloriesMcpServer);
 *   registerMcpSubServer(app, '/mcp/hive-manager', createHiveManagerMcpServer);
 *
 * Multiple registrations are safe because each one runs in an isolated
 * Fastify child scope.
 */
export function registerMcpSubServer(app: FastifyInstance, endpoint: string, createMcpServer: () => McpServer): void {
  app.register(async (child) => {
    await child.register(FastifyMcpServer, {
      createMcpServer,
      endpoint,
      authorization: {
        bearerMiddlewareOptions: {
          verifier: hubTokenVerifier,
        },
      },
    });

    const mcp = getMcpDecorator(child);
    mcpSubServers.push({ endpoint, sessionManager: mcp.getSessionManager() });
  });
}
