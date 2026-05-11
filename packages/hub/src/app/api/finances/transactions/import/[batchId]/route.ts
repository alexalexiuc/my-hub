import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { getUserActiveBudget, rollbackImportBatch } from '@my-hub/shared/services';

const paramsSchema = z.object({ batchId: z.string().uuid() });

const rollbackResponseSchema = z.object({ deletedCount: z.number().int() });

export const DELETE = route({ params: paramsSchema, response: rollbackResponseSchema })(async ({ user, params }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  try {
    return await rollbackImportBatch(user.id, budget.id, params.batchId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Rollback failed';
    if (msg === 'Import batch not found') routeHttpError(404, { error: msg });
    if (msg === 'Import batch already rolled back') routeHttpError(409, { error: msg });
    throw err;
  }
});
