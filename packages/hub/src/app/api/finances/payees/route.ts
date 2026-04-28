import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { getUserBudgets, getPayees } from '@my-hub/shared/services';
import { payeesResponseSchema } from '../contracts';

const QuerySchema = z.object({
  budgetId: z.coerce.number().int().positive().optional(),
});

export const GET = route({ query: QuerySchema, response: payeesResponseSchema })(async ({ user, query }) => {
  const budgets = await getUserBudgets(user.id);
  const budget = query.budgetId ? budgets.find(b => b.id === query.budgetId) : budgets[0];
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const payees = await getPayees(user.id, budget.id);
  return { payees, currency: budget.defaultCurrency };
});
