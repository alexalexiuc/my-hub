import { deleteLogsOlderThan3Months } from '@my-hub/shared/services';
import { logger } from '@my-hub/shared/utils';

export async function cleanupOldLogs(): Promise<void> {
  logger.info('[worker] Starting log cleanup...');
  const { rowsDeleted } = await deleteLogsOlderThan3Months();
  logger.info(`[worker] Log cleanup complete: ${rowsDeleted} row(s) deleted`);
}
