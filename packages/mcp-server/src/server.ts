import 'dotenv-mono/load';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import { healthRoutes } from './routes/health.js';
import { oauthRoutes } from './routes/oauth.js';
import { monitorRoute } from './routes/monitor.js';
import { publicRoutes } from './routes/public/index.js';
import { sessionCleanupPlugin } from './plugins/session-cleanup.js';
import { sessionLoggerPlugin } from './plugins/session-logger.js';
import relaxedJsonBodyPlugin from './plugins/relaxed-json-body.js';
import requestLoggerPlugin from './plugins/request-logger.js';
import { McpServerName } from '@my-hub/shared/constants';
import { registerMcpSubServer } from './mcp/sub-server.js';
import { mcpSubServers } from './mcp/registry.js';
import { createCaloriesServer } from './calories/server.js';
import { createTodoServer } from './todo/server.js';
import { createApiaryServer } from './apiary/server.js';
import { createTravelServer } from './travel/server.js';
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
    // Trust the X-Forwarded-Proto / X-Forwarded-Host headers set by a reverse proxy so
    // that req.protocol and req.hostname reflect the external scheme and host rather than
    // the plain-HTTP / unqualified values seen on the internal socket.
    trustProxy: true,
  });

  await app.register(cors, {
    origin: envConfig.CORS_ORIGIN,
  });

  // Claude probes MCP endpoints with Content-Type: application/json even when
  // some methods (notably DELETE) send no body. Treat empty JSON payloads as
  // null so the transport can handle the request instead of failing in parsing.
  await app.register(relaxedJsonBodyPlugin);

  // Parse application/x-www-form-urlencoded payloads used by OAuth /token.
  await app.register(formbody);

  // Custom two-line request logger (console + DB)
  await app.register(requestLoggerPlugin);

  // Public root routes: discovery metadata + favicon.
  await app.register(publicRoutes);

  // OAuth endpoints: /api/register  /api/authorize  /api/token
  await app.register(oauthRoutes, { prefix: '/api' });

  // Health check: /api/health
  await app.register(healthRoutes, { prefix: '/api' });

  // MCP sub-servers: /api/calories/mcp  /api/todo/mcp
  // Registered directly on app (not via prefix plugin) because FastifyMcpServer
  // manages its own child scopes and fp()-based plugins bypass prefix inheritance.
  registerMcpSubServer(app, '/api/calories/mcp', McpServerName.Calories, createCaloriesServer);
  registerMcpSubServer(app, '/api/todo/mcp', McpServerName.Todo, createTodoServer);
  registerMcpSubServer(app, '/api/apiary/mcp', McpServerName.Apiary, createApiaryServer);
  registerMcpSubServer(app, '/api/travel/mcp', McpServerName.Travel, createTravelServer);

  // Session cleanup plugin (reads mcpSubServers registry via onReady hook)
  await app.register(sessionCleanupPlugin);

  // Session logger plugin: intercepts transport onmessage to log MCP messages and tool calls
  await app.register(sessionLoggerPlugin);

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
