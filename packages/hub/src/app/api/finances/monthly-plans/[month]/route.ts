import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import {
  getUserActiveBudget,
  getMonthlyPlanFull,
  updateMonthlyPlan,
  checkMonthlyPlanExists,
} from '@my-hub/shared/services';
import { monthlyPlanResponseSchema } from '../../contracts';

const ParamsSchema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM') });

function nmOf(month: string): string {
  const parts = month.split('-').map(Number);
  const y = parts[0] ?? 2000;
  const m = parts[1] ?? 1;
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

async function buildResponse(userId: string, budgetId: number, month: string) {
  const [full, nextMonthExists] = await Promise.all([
    getMonthlyPlanFull(userId, budgetId, month),
    checkMonthlyPlanExists(userId, budgetId, nmOf(month)),
  ]);

  return {
    planId: full.plan.id,
    month: full.plan.month,
    availableAmount: full.plan.availableAmount,
    incomeAccountId: full.plan.incomeAccountId,
    currency: full.currency,
    items: full.items.map(item => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    summary: full.summary,
    nextMonthExists,
  };
}

export const GET = route({ params: ParamsSchema, response: monthlyPlanResponseSchema })(async ({ user, params }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });
  return buildResponse(user.id, budget.id, params.month);
});

const UpdateSchema = z
  .object({
    availableAmount: z.number().optional(),
    incomeAccountId: z.number().int().nullable().optional(),
  })
  .refine(body => body.availableAmount !== undefined || body.incomeAccountId !== undefined, {
    message: 'At least one field is required',
  });

export const PATCH = route({ params: ParamsSchema, body: UpdateSchema, response: monthlyPlanResponseSchema })(async ({
  user,
  params,
  body,
}) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const full = await getMonthlyPlanFull(user.id, budget.id, params.month);
  await updateMonthlyPlan(user.id, budget.id, full.plan.id, body);
  return buildResponse(user.id, budget.id, params.month);
});
