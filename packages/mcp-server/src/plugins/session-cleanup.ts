import fp from 'fastify-plugin';
import { mcpSubServers } from '../mcp/registry.js';
import { envConfig } from '../config/env.js';

export const sessionCleanupPlugin = fp(async (app) => {
  const sessionActivity = new Map<string, number>();

  // Track session activity across all registered sub-servers
  const attachListeners = () => {
    for (const { endpoint, sessionManager } of mcpSubServers) {
      sessionManager.on('sessionCreated', (sessionId: string) => {
        sessionActivity.set(sessionId, Date.now());
        app.log.info({ sessionId, endpoint }, 'MCP session created');
      });

      sessionManager.on('sessionDestroyed', (sessionId: string) => {
        sessionActivity.delete(sessionId);
        app.log.info({ sessionId, endpoint }, 'MCP session destroyed');
      });
    }
  };

  // Listeners are attached after all sub-servers are registered (onReady fires after all plugins)
  app.addHook('onReady', async () => {
    attachListeners();
  });

  const cleanupIntervalMs = envConfig.SESSION_CLEANUP_INTERVAL_MS;
  const maxIdleMs = envConfig.SESSION_MAX_IDLE_MS;

  const timer = setInterval(() => {
    const now = Date.now();
    let removed = 0;

    for (const [sessionId, lastActive] of sessionActivity.entries()) {
      const idleMs = now - lastActive;
      if (idleMs > maxIdleMs) {
        app.log.info({ sessionId, idleMs }, 'Removing stale MCP session');
        // Find the session manager that owns this session and destroy it
        for (const { sessionManager } of mcpSubServers) {
          if (sessionManager.getTransport(sessionId)) {
            sessionManager.destroySession(sessionId).catch((err: unknown) => {
              app.log.warn({ sessionId, err }, 'Failed to destroy stale MCP session');
            });
            break;
          }
        }
        sessionActivity.delete(sessionId);
        removed++;
      }
    }

    const remaining = sessionActivity.size;
    app.log.info({ removed, remaining }, 'MCP session cleanup completed');
  }, cleanupIntervalMs);
  // unref() allows the Node process to exit cleanly when no other work is pending
  // (e.g., during tests or graceful shutdown when the server is closed)
  timer.unref();

  app.addHook('onClose', async () => {
    clearInterval(timer);

    // Destroy all active sessions so their streaming connections close before Fastify stops.
    const destroys: Promise<void>[] = [];
    for (const [sessionId] of sessionActivity.entries()) {
      for (const { sessionManager } of mcpSubServers) {
        if (sessionManager.getTransport(sessionId)) {
          destroys.push(
            sessionManager.destroySession(sessionId).catch((err: unknown) => {
              app.log.warn({ sessionId, err }, 'Failed to destroy MCP session on close');
            }),
          );
          break;
        }
      }
    }
    await Promise.all(destroys);
    sessionActivity.clear();

    app.log.info('Session cleanup timer cleared');
  });
});
