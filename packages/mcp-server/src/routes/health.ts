import type { FastifyInstance } from 'fastify';
import { checkDatabaseConnection } from '@my-hub/shared/services';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (_req, reply) => {
    const databaseConnected = await checkDatabaseConnection();

    return reply.status(databaseConnected ? 200 : 503).send({
      status: databaseConnected ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      database: {
        status: databaseConnected ? 'ok' : 'error',
      },
    });
  });
}
