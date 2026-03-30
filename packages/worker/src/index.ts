import 'dotenv-mono/load';
import { startPollLoop } from './poll.js';

async function main() {
  console.log('[worker] Starting flight data sync worker...');
  await startPollLoop();
}

main().catch((err) => {
  console.error('[worker] Fatal error:', err);
  process.exit(1);
});
