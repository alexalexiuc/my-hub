import fp from 'fastify-plugin';
import { mcpSubServers } from '../mcp/registry.js';

export const monitorRoute = fp(async app => {
  const counters = new Map<string, { totalCreated: number; totalDestroyed: number }>();

  // Wire session event counters per sub-server after all sub-servers are registered
  app.addHook('onReady', async () => {
    for (const { endpoint, sessionManager } of mcpSubServers) {
      const c = { totalCreated: 0, totalDestroyed: 0 };
      counters.set(endpoint, c);
      sessionManager.on('sessionCreated', () => {
        c.totalCreated++;
      });
      sessionManager.on('sessionDestroyed', () => {
        c.totalDestroyed++;
      });
    }
  });

  app.get('/api/monitor', { logLevel: 'silent' }, async (_request, _reply) => {
    const mem = process.memoryUsage();

    const subServerStats = await Promise.all(
      mcpSubServers.map(async ({ endpoint, sessionManager }) => {
        const active = await sessionManager.getSessionsCount();
        const c = counters.get(endpoint) ?? { totalCreated: 0, totalDestroyed: 0 };
        return { endpoint, active, totalCreated: c.totalCreated, totalDestroyed: c.totalDestroyed };
      }),
    );

    const totalActive = subServerStats.reduce((sum, s) => sum + s.active, 0);
    const totalCreated = subServerStats.reduce((sum, s) => sum + s.totalCreated, 0);
    const totalDestroyed = subServerStats.reduce((sum, s) => sum + s.totalDestroyed, 0);

    return {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      version: '0', // TODO: Add version when versioning will be implemented
      node: process.version,
      memory: {
        rss: mem.rss,
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        external: mem.external,
      },
      sessions: {
        active: totalActive,
        totalCreated,
        totalDestroyed,
      },
      mcp: {
        transport: 'streamable-http',
        sessionStore: 'in-memory',
        subServers: subServerStats,
      },
    };
  });
});
