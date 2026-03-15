import 'dotenv-mono/load';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import FastifyMcpServer from 'fastify-mcp-server';
import { healthRoutes } from './routes/health.js';
import { oauthRoutes } from './routes/oauth.js';
import { monitorRoute } from './routes/monitor.js';
import { sessionCleanupPlugin } from './plugins/session-cleanup.js';
import { hubTokenVerifier } from './plugins/oauth-verifier.js';
import { createMcpServer } from './mcp/create-mcp-server.js';
import { envConfig } from './config/env.js';

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: envConfig.LOG_LEVEL,
      ...(envConfig.NODE_ENV === 'development' && {
        transport: { target: 'pino-pretty' },
      }),
    },
  });

  await app.register(cors, {
    origin: envConfig.CORS_ORIGIN,
  });

  // OAuth endpoints at root: /.well-known, /register, /authorize, /token
  await app.register(oauthRoutes);

  // Health check (legacy)
  await app.register(healthRoutes);

  // Register the MCP plugin with in-memory session store (default) + hub OAuth verifier
  await app.register(FastifyMcpServer, {
    createMcpServer,
    endpoint: '/mcp',
    authorization: {
      bearerMiddlewareOptions: {
        verifier: hubTokenVerifier,
      },
    },
  });

  // Session cleanup plugin (must run after FastifyMcpServer is registered)
  await app.register(sessionCleanupPlugin);

  // Monitor route (must run after FastifyMcpServer is registered)
  await app.register(monitorRoute);

  return app;
}
