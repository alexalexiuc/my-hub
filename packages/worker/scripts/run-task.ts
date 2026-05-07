import 'dotenv-mono/load';
import { logger } from '@my-hub/shared/utils';
import { tasks } from '../src/poll.js';

const taskName = process.argv[2];

if (!taskName) {
  logger.info('Usage: pnpm run-task <task-name>\n');
  logger.info('Available tasks:');
  for (const t of tasks) {
    logger.info(`  ${t.name}  (cron: ${t.cron})`);
  }
  process.exit(0);
}

const task = tasks.find(t => t.name === taskName);

if (!task) {
  logger.error(`Unknown task: "${taskName}"`);
  logger.error(`Available: ${tasks.map(t => t.name).join(', ')}`);
  process.exit(1);
}

logger.info(`[run-task] Running: ${task.name}`);
task
  .fn()
  .then(() => {
    logger.info(`[run-task] Done: ${task.name}`);
    process.exit(0);
  })
  .catch(err => {
    logger.error(`[run-task] Failed: ${task.name}`, err);
    process.exit(1);
  });
