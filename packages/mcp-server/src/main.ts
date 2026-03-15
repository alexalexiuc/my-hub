import { buildServer } from './server.js';
import { envConfig } from './config/env.js';
import closeWithGrace from 'close-with-grace';

async function main() {
  const app = await buildServer();

  closeWithGrace({ delay: 5000 }, async ({ signal, err }: { signal?: string; err?: Error }) => {
    if (err) {
      app.log.error({ err }, 'Server closing due to error');
    } else {
      app.log.info(`${signal ?? 'shutdown'} received — shutting down gracefully`);
    }
    await app.close();
  });

  await app.listen({
    port: envConfig.MCP_SERVER_PORT,
    host: envConfig.HOST,
  });

  app.log.info(`MCP server listening on http://${envConfig.HOST}:${envConfig.MCP_SERVER_PORT}/mcp`);
}

main().catch((err: unknown) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
