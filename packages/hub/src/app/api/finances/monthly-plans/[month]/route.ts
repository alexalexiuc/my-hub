import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import {
  getUserActiveBudget,
  getMonthlyPlanFull,
  updateMonthlyPlan,
  checkMonthlyPlanExists,
} from '@my-hub/shared/services';
import { supportedCurrencySchema } from '../../currency.schema';

export const monthlyPlanItemSchema = z.object({
  id: z.number().int(),
  planId: z.number().int(),
  name: z.string(),
  amount: z.number(),
  currency: supportedCurrencySchema,
  categoryId: z.number().int().nullable(),
  merchantId: z.number().int().nullable(),
  linkedAccountId: z.number().int().nullable(),
  assignedAmount: z.number(),
  isAssigned: z.boolean(),
  assignedTransactionId: z.number().int().nullable(),
  sortOrder: z.number().int(),
  notes: z.string().nullable(),
  categoryName: z.string().nullable(),
  merchantName: z.string().nullable(),
  linkedAccountName: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const monthlyPlanSummarySchema = z.object({
  planned: z.number(),
  remainingPotential: z.number(),
  remainingReal: z.number(),
  assignedCount: z.number().int(),
  totalCount: z.number().int(),
});

export const monthlyPlanResponseSchema = z.object({
  planId: z.number().int(),
  month: z.string(),
  availableAmount: z.number(),
  incomeAccountId: z.number().int().nullable(),
  currency: supportedCurrencySchema,
  items: z.array(monthlyPlanItemSchema),
  summary: monthlyPlanSummarySchema,
  nextMonthExists: z.boolean(),
});

export type MonthlyPlanItem = z.infer<typeof monthlyPlanItemSchema>;
export type MonthlyPlanSummary = z.infer<typeof monthlyPlanSummarySchema>;
export type MonthlyPlanResponse = z.infer<typeof monthlyPlanResponseSchema>;

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
