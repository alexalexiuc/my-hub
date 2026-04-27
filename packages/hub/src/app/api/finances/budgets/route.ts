import { z } from 'zod';
import { route, created } from '@/lib/api/route';
import { createBudget } from '@my-hub/shared/services';

const BudgetCreateSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  defaultCurrency: z.string().trim().optional(),
});

export const POST = route({ body: BudgetCreateSchema })(async ({ user, body }) => {
  const budget = await createBudget(user.id, {
    name: body.name.trim(),
    defaultCurrency: (body.defaultCurrency ?? 'EUR').trim().toUpperCase(),
  });

  return created({ budget });
});
