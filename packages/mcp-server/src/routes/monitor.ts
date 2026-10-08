import fp from 'fastify-plugin';
import { mcpSubServers, type McpEndpointStats } from '../mcp/registry.js';

export const monitorRoute = fp(async app => {
  app.get('/api/monitor', { logLevel: 'silent' }, async (_request, _reply) => {
    const mem = process.memoryUsage();

    const subServerStats = mcpSubServers.map(({ endpoint, serverName, getStats }) => ({
      ...getStats(),
      endpoint,
      serverName,
    }));

    const sum = (key: keyof McpEndpointStats) => subServerStats.reduce((total, s) => total + s[key], 0);

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
      requests: {
        total: sum('requestsTotal'),
        inFlight: sum('inFlightRequests'),
        errors: sum('errorsTotal'),
      },
      mcp: {
        transport: 'streamable-http',
        protocolVersion: '2026-07-28',
        sessions: 'stateless',
        subServers: subServerStats,
      },
    };
  });
});
