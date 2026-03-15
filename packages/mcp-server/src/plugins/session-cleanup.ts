import fp from 'fastify-plugin';
import { getMcpDecorator } from 'fastify-mcp-server';
import { envConfig } from '../config/env.js';

export const sessionCleanupPlugin = fp(async (app) => {
  const mcpDecorator = getMcpDecorator(app);
  const sessionManager = mcpDecorator.getSessionManager();
  const sessionActivity = new Map<string, number>();

  // Track session creation timestamps for idle-time cleanup
  sessionManager.on('sessionCreated', (sessionId: string) => {
    sessionActivity.set(sessionId, Date.now());
    app.log.info({ sessionId }, 'MCP session created');
  });

  sessionManager.on('sessionDestroyed', (sessionId: string) => {
    sessionActivity.delete(sessionId);
    app.log.info({ sessionId }, 'MCP session destroyed');
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
        sessionManager.destroySession(sessionId).catch((err: unknown) => {
          app.log.warn({ sessionId, err }, 'Failed to destroy stale MCP session');
        });
        sessionActivity.delete(sessionId);
        removed++;
      }
    }

    const remaining = sessionActivity.size;
    app.log.info({ removed, remaining }, 'MCP session cleanup completed');
  }, cleanupIntervalMs);

  app.addHook('onClose', async () => {
    clearInterval(timer);
    app.log.info('Session cleanup timer cleared');
  });
});
