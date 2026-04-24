import { logger } from '@my-hub/shared/utils';
import { buildServer } from './server.js';
import { envConfig } from './config/env.js';
import closeWithGrace from 'close-with-grace';

async function main() {
  const app = await buildServer();

  closeWithGrace({ delay: 500 }, async ({ signal, err }: { signal?: string; err?: Error }) => {
    if (err) {
      app.log.error({ err }, 'Server closing due to error');
    } else {
      app.log.info(`${signal ?? 'shutdown'} received - shutting down gracefully`);
    }
    await app.close();
    process.exit(err ? 1 : 0);
  });

  await app.listen({
    port: envConfig.MCP_SERVER_PORT,
    host: envConfig.MCP_HOST,
  });
}

main().catch((err: unknown) => {
  logger.error('Fatal startup error:', err);
  process.exit(1);
});
