import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { getUserActiveBudget, mergePayees } from '@my-hub/shared/services';

const MergePayeesBodySchema = z.object({
  targetId: z.number().int().positive(),
  sourceIds: z.array(z.number().int().positive()).min(1),
  canonicalName: z.string().trim().min(1).optional(),
});

const MergePayeesResponseSchema = z.object({
  mergedCount: z.number().int(),
  targetId: z.number().int(),
  canonicalName: z.string(),
});

export const POST = route({
  body: MergePayeesBodySchema,
  response: MergePayeesResponseSchema,
})(async ({ user, body }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  try {
    const result = await mergePayees(user.id, budget.id, body.targetId, body.sourceIds, body.canonicalName);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Merge failed';
    routeHttpError(400, { error: msg });
  }
});
