import 'dotenv-mono/load';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import { healthRoutes } from './routes/health.js';
import { oauthRoutes } from './routes/oauth.js';
import { monitorRoute } from './routes/monitor.js';
import { sessionCleanupPlugin } from './plugins/session-cleanup.js';
import requestLoggerPlugin from './plugins/request-logger.js';
import { McpServerName } from '@my-hub/shared/schema';
import { registerMcpSubServer } from './mcp/sub-server.js';
import { mcpSubServers } from './mcp/registry.js';
import { createCaloriesServer } from './calories/server.js';
import { createTodoServer } from './todo/server.js';
import { envConfig } from './config/env.js';

export async function buildServer() {
  // Clear the shared registry so that repeated buildServer() calls (e.g. in tests)
  // don't accumulate duplicate sub-server entries.
  mcpSubServers.length = 0;
  const app = Fastify({
    logger: {
      level: envConfig.LOG_LEVEL,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          singleLine: true,
          ignore: 'pid,hostname',
        },
      },
    },
    // Disable Fastify's built-in request/response logging — we use our own
    // requestLoggerPlugin which formats lines as `<-- GET /path` / `--> GET /path`.
    disableRequestLogging: true,
  });

  await app.register(cors, {
    origin: envConfig.CORS_ORIGIN,
  });

  // Parse application/x-www-form-urlencoded payloads used by OAuth /token.
  await app.register(formbody);

  // Custom two-line request logger (console + DB)
  await app.register(requestLoggerPlugin);

  // OAuth discovery — must stay at root per RFC 8414.
  // Points clients to the /api-prefixed endpoints below.
  app.get('/.well-known/oauth-authorization-server', { logLevel: 'silent' }, async (req, reply) => {
    const base = `${req.protocol}://${req.hostname}`;
    return reply.send({
      issuer: base,
      authorization_endpoint: `${base}/api/authorize`,
      token_endpoint: `${base}/api/token`,
      registration_endpoint: `${base}/api/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'client_credentials'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['client_secret_post'],
    });
  });

  // OAuth endpoints: /api/register  /api/authorize  /api/token
  // (oauthRoutes no longer includes /.well-known)
  await app.register(oauthRoutes, { prefix: '/api' });

  // Health check: /api/health
  await app.register(healthRoutes, { prefix: '/api' });

  // MCP sub-servers: /api/calories/mcp  /api/todo/mcp
  // Registered directly on app (not via prefix plugin) because FastifyMcpServer
  // manages its own child scopes and fp()-based plugins bypass prefix inheritance.
  registerMcpSubServer(app, '/api/calories/mcp', McpServerName.Calories, createCaloriesServer);
  registerMcpSubServer(app, '/api/todo/mcp', McpServerName.Todo, createTodoServer);
  // registerMcpSubServer(app, '/api/hive-manager/mcp', McpServerName.Hive, createHiveManagerServer);

  // Session cleanup plugin (reads mcpSubServers registry via onReady hook)
  await app.register(sessionCleanupPlugin);

  // Monitor route: /api/monitor
  // Uses fp() so registered at root — path is set to /api/monitor directly in monitor.ts.
  await app.register(monitorRoute);

  // Silently absorb requests to unknown paths (scanner/bot probes).
  // The logLevel:'silent' flag causes requestLoggerPlugin to skip both console + DB logging.
  app.setNotFoundHandler(async (_req, reply) => {
    return reply.status(404).send();
  });

  return app;
}
