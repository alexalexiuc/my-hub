import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { checkDatabaseConnection } from '@my-hub/shared/services';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  timestamp: string;
  database: {
    status: 'ok' | 'error';
  };
}

/**
 * Pure handler function for the /health endpoint.
 * Testable in isolation without Fastify integration.
 */
export async function getHealthStatus(): Promise<HealthStatus> {
  const databaseConnected = await checkDatabaseConnection();

  return {
    status: databaseConnected ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    database: {
      status: databaseConnected ? 'ok' : 'error',
    },
  };
}

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', { logLevel: 'silent' }, async (_req: FastifyRequest, reply: FastifyReply) => {
    const health = await getHealthStatus();
    return reply.status(health.status === 'ok' ? 200 : 503).send(health);
  });
}
