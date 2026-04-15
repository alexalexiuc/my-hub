import { deleteLogsOlderThan3Months } from '@my-hub/shared/services';
import { logger } from '@my-hub/shared/utils';

export async function cleanupOldDbLogs(): Promise<void> {
  logger.info('[worker] Starting DB log cleanup...');
  const { rowsDeleted } = await deleteLogsOlderThan3Months();
  logger.info(`[worker] DB log cleanup complete: ${rowsDeleted} row(s) deleted`);
}
