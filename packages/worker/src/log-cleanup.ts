import { deleteLogsOlderThan3Months } from '@my-hub/shared/services';

export async function cleanupOldLogs(): Promise<void> {
  console.log('[worker] Starting log cleanup...');
  const { rowsDeleted } = await deleteLogsOlderThan3Months();
  console.log(`[worker] Log cleanup complete: ${rowsDeleted} row(s) deleted`);
}
