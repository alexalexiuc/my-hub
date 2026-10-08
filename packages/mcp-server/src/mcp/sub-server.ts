import type { FastifyInstance } from 'fastify';
import type { McpServer } from '@modelcontextprotocol/server';
import FastifyMcpServer, { getMcpDecorator } from 'fastify-mcp-server';
import type { McpServerName } from '@my-hub/shared/constants';
import { logger } from '@my-hub/shared/utils';
import { createHubTokenVerifier } from '../plugins/oauth-verifier.js';
import { envConfig } from '../config/env.js';
import { mcpSubServers } from './registry.js';

/**
 * Registers an MCP sub-server in its own Fastify child scope.
 *
 * Each domain (calories, travel, …) gets its own endpoint and bearer-auth
 * verifier that also checks the user exists and has the server enabled.
 *
 * MCP 2026-07-28 Streamable HTTP is stateless: there are no sessions, and the
 * SDK calls `createMcpServer` once per HTTP request. Keep the factory cheap —
 * tool definitions and schemas are prebuilt at module load (see `defineTool`),
 * so the factory only instantiates `McpServer` and registers them.
 *
 * Usage in server.ts:
 *   registerMcpSubServer(app, '/api/calories/mcp', 'calories', createCaloriesServer);
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
  app.register(async child => {
    await child.register(FastifyMcpServer, {
      transport: 'http',
      createMcpServer,
      endpoint,
      allowedHosts: envConfig.MCP_ALLOWED_HOSTS,
      allowedOrigins: envConfig.MCP_ALLOWED_ORIGINS,
      authorization: {
        bearer: {
          verifier: createHubTokenVerifier(serverName),
        },
      },
      handlerOptions: {
        onerror: err => logger.warn(`[mcp:${serverName}] ${err.message}`),
      },
    });

    const mcp = getMcpDecorator(child);
    if (mcp.transport === 'http') {
      mcpSubServers.push({ endpoint, serverName, getStats: () => mcp.getStats() });
    }
  });
  app.log.info(`Registered MCP sub-server "${serverName}" at endpoint "${endpoint}"`);
}
