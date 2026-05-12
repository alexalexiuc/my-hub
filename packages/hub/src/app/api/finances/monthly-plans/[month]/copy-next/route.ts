import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { getUserActiveBudget, copyToNextMonth } from '@my-hub/shared/services';

const ParamsSchema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) });

export const monthlyPlanCopyResponseSchema = z.object({
  created: z.boolean(),
  targetMonth: z.string(),
});

export type MonthlyPlanCopyResponse = z.infer<typeof monthlyPlanCopyResponseSchema>;

export const POST = route({ params: ParamsSchema })(async ({ user, params }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const result = await copyToNextMonth(user.id, budget.id, params.month);
  return { created: result.created, targetMonth: result.targetMonth };
});
