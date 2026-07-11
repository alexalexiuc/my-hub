import { getAllBudgetIds, writeNetWorthSnapshot } from '@my-hub/shared/services';
import { toUTCDateStr, logger } from '@my-hub/shared/utils';

export async function snapshotFinanceNetWorth(): Promise<void> {
  const month = toUTCDateStr(new Date()).slice(0, 7);
  const budgetIds = await getAllBudgetIds();

  let written = 0;
  for (const budgetId of budgetIds) {
    try {
      await writeNetWorthSnapshot(budgetId, month);
      written++;
    } catch (err) {
      logger.error(`[finances-networth-snapshot] Failed for budget ${budgetId}:`, err);
    }
  }

  logger.info(`[finances-networth-snapshot] Wrote ${written} net worth snapshot(s) for ${month}`);
}
