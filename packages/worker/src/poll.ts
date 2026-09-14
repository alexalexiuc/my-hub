import { Cron } from 'croner';
import { logger } from '@my-hub/shared/utils';
import { syncDueFlights } from './flight-sync.js';
import { backupDbToS3 } from './db-backup.js';
import { backupDockerLogsToS3 } from './docker-log-backup.js';
import { cleanupOldDbLogs } from './db-log-cleanup.js';
import { sendCaloriesWeeklyReports } from './calories-weekly-report.js';
import { sendCaloriesMonthlyReports } from './calories-monthly-report.js';
import { recalculateFinanceBalances } from './finances-balance-recalc.js';
import { syncTickerPrices } from './ticker-price-sync.js';
import { snapshotFinanceNetWorth } from './finance-networth-snapshot.js';
import { sendFinanceMonthlyReports } from './finance-monthly-report.js';
import { sendFinanceYearlyReports } from './finance-yearly-report.js';

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
    // Xetra closes 17:30 CET (15:30–16:30 UTC depending on DST); 18:00 UTC is
    // safely after close year-round. Daily incl. weekends is fine — only missing
    // ranges are fetched, so non-trading days are cheap no-ops.
    name: 'ticker-price-sync',
    cron: '0 18 * * *', // every day at 18:00 UTC
    fn: syncTickerPrices,
  },
  {
    // Runs before finance-monthly-report so the report's net worth trajectory (yearly) and
    // reconciliation checks see a freshly-snapshotted just-completed month.
    name: 'finance-networth-snapshot',
    cron: '0 7 1 * *', // 1st of every month at 07:00
    fn: snapshotFinanceNetWorth,
  },
  {
    name: 'finance-monthly-report',
    cron: '0 8 1 * *', // 1st of every month at 08:00
    fn: sendFinanceMonthlyReports,
  },
  {
    // Jan 5th, not Jan 1st — gives a buffer for late-posting December transactions and
    // month-end reconciliation before the yearly report is generated.
    name: 'finance-yearly-report',
    cron: '0 8 5 1 *', // January 5th at 08:00
    fn: sendFinanceYearlyReports,
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
