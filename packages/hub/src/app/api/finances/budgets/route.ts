import { z } from 'zod';
import { route, created } from '@/lib/api/route';
import { createBudget, getUserBudgets, setActiveBudget } from '@my-hub/shared/services';
import { supportedCurrencySchema } from '../currency.schema';
import { okResponseSchema } from '../shared.schema';
import { budgetInfoSchema } from '../budget/budget.schema';
export type { BudgetInfo } from '../budget/budget.schema';

export const budgetCreateResponseSchema = z.object({
  budget: budgetInfoSchema,
});

export type BudgetCreateResponse = z.infer<typeof budgetCreateResponseSchema>;

const BudgetCreateSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  defaultCurrency: supportedCurrencySchema.optional(),
});

const SetActiveBudgetSchema = z.object({
  activeBudgetId: z.number().int().positive(),
});

export const budgetsListResponseSchema = z.object({
  budgets: z.array(budgetInfoSchema),
});

export type BudgetCreateBody = z.infer<typeof BudgetCreateSchema>;
export type BudgetActivateBody = z.infer<typeof SetActiveBudgetSchema>;
export type BudgetsListResponse = z.infer<typeof budgetsListResponseSchema>;

export const GET = route({ response: budgetsListResponseSchema })(async ({ user }) => {
  const budgets = await getUserBudgets(user.id);
  return {
    budgets: budgets.map(b => ({
      id: b.id,
      name: b.name,
      defaultCurrency: b.defaultCurrency,
      createdByUserId: b.createdByUserId,
      isOwner: b.createdByUserId === user.id,
      isActive: b.isActive,
    })),
  };
});

export const POST = route({ body: BudgetCreateSchema, response: budgetCreateResponseSchema })(async ({
  user,
  body,
}) => {
  const budget = await createBudget(user.id, {
    name: body.name.trim(),
    defaultCurrency: body.defaultCurrency ?? 'EUR',
  });

  return created({ budget: { ...budget, isOwner: true, isActive: true } });
});

export const PATCH = route({ body: SetActiveBudgetSchema, response: okResponseSchema })(async ({ user, body }) => {
  await setActiveBudget(user.id, body.activeBudgetId);
  return { ok: true };
});
