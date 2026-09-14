import { getAllBudgetsForSystem, snapshotNetWorth } from '@my-hub/shared/services';
import { dateToString, getLastMonthStart, logger } from '@my-hub/shared/utils';

/**
 * Persists the just-completed month's net worth snapshot for every budget, feeding the yearly
 * report's net worth trajectory (financeNetWorthSnapshots was previously never written to).
 * Runs early on the 1st of the month — live account balances at that point still reflect the
 * prior month's activity, so they're labelled with the just-completed month.
 */
export async function snapshotFinanceNetWorth(): Promise<void> {
  const budgets = await getAllBudgetsForSystem();
  if (budgets.length === 0) return;

  const month = dateToString(getLastMonthStart(), 'YYYY-MM');
  logger.info(`[finance-networth-snapshot] Snapshotting net worth for ${budgets.length} budget(s) — month ${month}`);

  let succeeded = 0;
  let failed = 0;

  for (const { budgetId, ownerUserId } of budgets) {
    try {
      await snapshotNetWorth(ownerUserId, budgetId, month);
      succeeded++;
    } catch (err) {
      logger.error(`[finance-networth-snapshot] Failed for budget ${budgetId}:`, err);
      failed++;
    }
  }

  logger.info(`[finance-networth-snapshot] Done — succeeded: ${succeeded}, failed: ${failed}`);
}
