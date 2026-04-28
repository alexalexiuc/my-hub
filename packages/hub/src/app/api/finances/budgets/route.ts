import { z } from 'zod';
import { route, created } from '@/lib/api/route';
import { createBudget, getUserBudgets, setActiveBudget } from '@my-hub/shared/services';

const BudgetCreateSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  defaultCurrency: z.string().trim().optional(),
});

const SetActiveBudgetSchema = z.object({
  activeBudgetId: z.number().int().positive(),
});

export const GET = route(async ({ user }) => {
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

export const POST = route({ body: BudgetCreateSchema })(async ({ user, body }) => {
  const budget = await createBudget(user.id, {
    name: body.name.trim(),
    defaultCurrency: (body.defaultCurrency ?? 'EUR').trim().toUpperCase(),
  });

  return created({ budget });
});

export const PATCH = route({ body: SetActiveBudgetSchema })(async ({ user, body }) => {
  await setActiveBudget(user.id, body.activeBudgetId);
  return { ok: true };
});
