import fp from 'fastify-plugin';
import { getMcpDecorator } from 'fastify-mcp-server';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf-8')) as { version: string };

export const monitorRoute = fp(async (app) => {
  const mcpDecorator = getMcpDecorator(app);
  const sessionManager = mcpDecorator.getSessionManager();

  let totalCreated = 0;
  let totalDestroyed = 0;

  sessionManager.on('sessionCreated', () => {
    totalCreated++;
  });
  sessionManager.on('sessionDestroyed', () => {
    totalDestroyed++;
  });

  app.get('/monitor', async (_request, _reply) => {
    const stats = await mcpDecorator.getStats();
    const mem = process.memoryUsage();

    return {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      version: pkg.version,
      node: process.version,
      memory: {
        rss: mem.rss,
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        external: mem.external,
      },
      sessions: {
        active: stats.activeSessions,
        totalCreated,
        totalDestroyed,
      },
      mcp: {
        endpoint: '/mcp',
        transport: 'streamable-http',
        sessionStore: 'in-memory',
      },
    };
  });
});
