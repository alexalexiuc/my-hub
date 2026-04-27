import { z } from 'zod';
import { route, routeHttpError, created } from '@/lib/api/route';
import { getUserBudgets, createGroup } from '@my-hub/shared/services';

const GroupCreateSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const POST = route({ body: GroupCreateSchema })(async ({ user, body }) => {
  const budgets = await getUserBudgets(user.id);
  const budget = budgets[0];
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const group = await createGroup(user.id, budget.id, {
    name: body.name.trim(),
    sortOrder: body.sortOrder ?? 0,
  });

  return created(group);
});
