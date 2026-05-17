import { getAllAccountIds, recalculateAccountBalance } from '@my-hub/shared/services';
import { logger } from '@my-hub/shared/utils';

export async function recalculateFinanceBalances(): Promise<void> {
  const accountIds = await getAllAccountIds();

  if (accountIds.length === 0) return;

  logger.info(`[worker] Recalculating balances for ${accountIds.length} account(s)...`);

  let updated = 0;
  let failed = 0;

  for (const id of accountIds) {
    try {
      const result = await recalculateAccountBalance(id);
      if (result) {
        const hasChanged = result.oldBalance !== result.newBalance;
        const diffText = hasChanged ? `${result.newBalance - result.oldBalance}` : 'no change';
        logger.info(
          `[worker] Recalculated balance for account ${id} (${result.name}): ${result.oldBalance} -> ${result.newBalance} ~ ${diffText}`,
        );
        if (hasChanged) updated++;
      }
    } catch (err) {
      logger.error(`[worker] Failed to recalculate balance for account ${id}:`, err);
      failed++;
    }
  }

  logger.info(`[worker] Balance recalculation complete: ${updated} updated, ${failed} failed`);
}
