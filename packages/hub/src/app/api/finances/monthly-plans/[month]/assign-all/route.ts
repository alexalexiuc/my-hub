import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { getUserActiveBudget, getMonthlyPlanFull, bulkAssignAll } from '@my-hub/shared/services';

const ParamsSchema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) });

export const POST = route({ params: ParamsSchema })(async ({ user, params }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const full = await getMonthlyPlanFull(user.id, budget.id, params.month);
  await bulkAssignAll(user.id, full.plan.id);
  return { ok: true };
});
