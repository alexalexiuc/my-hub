import { writeAccountBalanceSnapshots } from '@my-hub/shared/services';
import { toUTCDateStr, logger } from '@my-hub/shared/utils';

export async function snapshotFinanceAccountBalances(): Promise<void> {
  const dateStr = toUTCDateStr(new Date());
  const { written } = await writeAccountBalanceSnapshots(dateStr);
  logger.info(`[finances-account-snapshot] Wrote ${written} account balance snapshot(s) for ${dateStr}`);
}
