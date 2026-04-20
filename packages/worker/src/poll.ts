import { Cron } from 'croner';
import { logger } from '@my-hub/shared/utils';
import { syncDueFlights } from './flight-sync.js';
import { backupDbToS3 } from './db-backup.js';
import { backupDockerLogsToS3 } from './docker-log-backup.js';
import { cleanupOldDbLogs } from './db-log-cleanup.js';
import { sendCaloriesWeeklyReports } from './calories-weekly-report.js';
import { sendCaloriesMonthlyReports } from './calories-monthly-report.js';

interface Task {
  name: string;
  cron: string;
  fn: () => Promise<void>;
}

export const tasks: Task[] = [
  {
    name: 'flight-sync',
    cron: '*/5 * * * *', // every 5th minute
    fn: syncDueFlights,
  },
  {
    name: 'db-backup',
    cron: '0 0 1 * * *', // every day at 1:00 AM
    fn: backupDbToS3,
  },
  {
    name: 'docker-log-backup',
    cron: '0 0 3 * * *', // every day at 3:00 AM
    fn: backupDockerLogsToS3,
  },
  {
    name: 'db-log-cleanup',
    cron: '0 0 1 1 * *', // 1st of every month at 1:00
    fn: cleanupOldDbLogs,
  },
  {
    name: 'calories-weekly-report',
    cron: '0 8 * * 1', // every Monday at 08:00
    fn: sendCaloriesWeeklyReports,
  },
  {
    name: 'calories-monthly-report',
    cron: '0 8 1 * *', // 1st of every month at 08:00
    fn: sendCaloriesMonthlyReports,
  },
];

export function startPollLoop(): void {
  logger.info('[worker] Scheduling tasks:');

  for (const task of tasks) {
    new Cron(task.cron, { protect: true, timezone: 'UTC' }, async () => {
      try {
        await task.fn();
      } catch (err) {
        logger.error(`[worker] Error in task ${task.name}:`, err);
      }
    });

    logger.info(`[worker]   ${task.name} → ${task.cron}`);
  }
}
