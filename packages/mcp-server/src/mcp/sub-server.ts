import type { FastifyInstance } from 'fastify';
import { toNodeHandler, toWebRequest } from '@modelcontextprotocol/node';
import {
  bearerAuthChallengeResponse,
  createMcpHandler,
  isLegacyRequest,
  verifyBearerToken,
} from '@modelcontextprotocol/server';
import type { McpServer } from '@modelcontextprotocol/server';
import FastifyMcpServer, { getMcpDecorator } from 'fastify-mcp-server';
import type { McpServerName } from '@my-hub/shared/constants';
import { logger } from '@my-hub/shared/utils';
import { createHubTokenVerifier } from '../plugins/oauth-verifier.js';
import { attachMcpRequestLogger } from '../plugins/mcp-request-logger.js';
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
    const onerror = (err: Error) => logger.warn(`[mcp:${serverName}] ${err.message}`);
    const verifier = createHubTokenVerifier(serverName);
    const legacyHandler = createMcpHandler(createMcpServer, { legacy: 'stateless', onerror });
    const legacyNodeHandler = toNodeHandler(legacyHandler);
    child.addHook('onClose', async () => {
      await legacyHandler.close();
    });

    attachMcpRequestLogger(child, endpoint);

    // Runs before the plugin route's own preHandler (scope hooks first), after Host/Origin validation (route onRequest).
    child.addHook('preHandler', async (req, reply) => {
      if (req.method !== 'POST' || req.routeOptions.url !== endpoint || req.body == null) return;
      if (!(await isLegacyRequest(await toWebRequest(req.raw, req.body), req.body))) return;

      try {
        const auth = await verifyBearerToken(req.headers.authorization, { verifier });
        Object.assign(req, { auth });
        Object.assign(req.raw, { auth });
      } catch (error) {
        const response = bearerAuthChallengeResponse(error);
        for (const [name, value] of response.headers) reply.header(name, value);
        return reply.status(response.status).send(await response.json());
      }

      reply.hijack();
      await legacyNodeHandler(req.raw, reply.raw, req.body);
    });

    await child.register(FastifyMcpServer, {
      transport: 'http',
      createMcpServer,
      endpoint,
      allowedHosts: envConfig.MCP_ALLOWED_HOSTS,
      allowedOrigins: envConfig.MCP_ALLOWED_ORIGINS,
      authorization: {
        bearer: {
          verifier,
        },
      },
      handlerOptions: { onerror },
    });

    const mcp = getMcpDecorator(child);
    if (mcp.transport === 'http') {
      mcpSubServers.push({ endpoint, serverName, getStats: () => mcp.getStats() });
    }
  });
  app.log.info(`Registered MCP sub-server "${serverName}" at endpoint "${endpoint}"`);
}
