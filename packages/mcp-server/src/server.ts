import 'dotenv-mono/load';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import { healthRoutes } from './routes/health.js';
import { oauthRoutes } from './routes/oauth.js';
import { monitorRoute } from './routes/monitor.js';
import { sessionCleanupPlugin } from './plugins/session-cleanup.js';
import requestLoggerPlugin from './plugins/request-logger.js';
import { McpServerName } from '@my-hub/shared/services';
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

  // OAuth endpoints at root: /.well-known, /register, /authorize, /token
  await app.register(oauthRoutes);

  // Health check
  await app.register(healthRoutes);

  // MCP sub-servers — each domain gets its own endpoint and session manager.
  // Add more sub-servers here as new domains are implemented.
  registerMcpSubServer(app, '/calories/mcp', McpServerName.Calories, createCaloriesServer);
  registerMcpSubServer(app, '/todo/mcp', McpServerName.Todo, createTodoServer);
  // registerMcpSubServer(app, '/hive-manager/mcp', McpServerName.Hive, createHiveManagerServer);

  // Session cleanup plugin (reads mcpSubServers registry via onReady hook)
  await app.register(sessionCleanupPlugin);

  // Monitor route (reads mcpSubServers registry via onReady hook)
  await app.register(monitorRoute);

  return app;
}
