import { Cron } from 'croner';
import { logger } from '@my-hub/shared/utils';
import { syncDueFlights } from './flight-sync.js';
import { backupDbToS3 } from './db-backup.js';
import { backupDockerLogsToS3 } from './docker-log-backup.js';
import { cleanupOldDbLogs } from './db-log-cleanup.js';
import { sendCaloriesWeeklyReports } from './calories-weekly-report.js';
import { sendCaloriesMonthlyReports } from './calories-monthly-report.js';
import { recalculateFinanceBalances } from './finances-balance-recalc.js';
import { snapshotFinanceAccountBalances } from './finances-account-snapshot.js';
import { snapshotFinanceNetWorth } from './finances-networth-snapshot.js';
import { syncTickerPrices } from './ticker-price-sync.js';

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
  {
    name: 'finances-balance-recalc',
    cron: '0 3 * * *', // every day at 03:00
    fn: recalculateFinanceBalances,
  },
  {
    // Runs after finances-balance-recalc so the recorded balance is the reconciled one.
    name: 'finances-account-snapshot',
    cron: '15 3 * * *', // every day at 03:15
    fn: snapshotFinanceAccountBalances,
  },
  {
    // Runs after finances-account-snapshot, same reasoning — rolls up reconciled balances
    // into the current month's net worth total.
    name: 'finances-networth-snapshot',
    cron: '30 3 * * *', // every day at 03:30
    fn: snapshotFinanceNetWorth,
  },
  {
    // Xetra closes 17:30 CET (15:30–16:30 UTC depending on DST); 18:00 UTC is
    // safely after close year-round. Daily incl. weekends is fine — only missing
    // ranges are fetched, so non-trading days are cheap no-ops.
    name: 'ticker-price-sync',
    cron: '0 18 * * *', // every day at 18:00 UTC
    fn: syncTickerPrices,
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
