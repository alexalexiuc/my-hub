import 'dotenv-mono/load';
import { logger } from '@my-hub/shared/utils';
import { tasks } from '../src/poll.js';

const taskName = process.argv[2];

if (!taskName) {
  console.log('Usage: pnpm run-task <task-name>\n');
  console.log('Available tasks:');
  for (const t of tasks) {
    console.log(`  ${t.name}  (cron: ${t.cron})`);
  }
  process.exit(0);
}

const task = tasks.find(t => t.name === taskName);

if (!task) {
  console.error(`Unknown task: "${taskName}"`);
  console.error(`Available: ${tasks.map(t => t.name).join(', ')}`);
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
