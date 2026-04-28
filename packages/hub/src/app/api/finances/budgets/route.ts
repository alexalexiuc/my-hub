import { z } from 'zod';
import { route, created } from '@/lib/api/route';
import { createBudget, getUserBudgets, setActiveBudget } from '@my-hub/shared/services';
import { budgetsListResponseSchema, budgetCreateResponseSchema, okResponseSchema } from '../contracts';

const BudgetCreateSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  defaultCurrency: z.string().trim().optional(),
});

const SetActiveBudgetSchema = z.object({
  activeBudgetId: z.number().int().positive(),
});

export const GET = route({ response: budgetsListResponseSchema })(async ({ user }) => {
  const budgets = await getUserBudgets(user.id);
  return {
    budgets: budgets.map(b => ({
      id: b.id,
      name: b.name,
      defaultCurrency: b.defaultCurrency,
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
    defaultCurrency: (body.defaultCurrency ?? 'EUR').trim().toUpperCase(),
  });

  return created({ budget });
});

export const PATCH = route({ body: SetActiveBudgetSchema, response: okResponseSchema })(async ({ user, body }) => {
  await setActiveBudget(user.id, body.activeBudgetId);
  return { ok: true };
});
