import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { getUserBudgets, getPayees } from '@my-hub/shared/services';

export const payeeWithSuggestionSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  aliases: z.array(z.string()),
  description: z.string().nullable(),
  useCount: z.number().int(),
  lastUsedAt: z.string().optional(),
  lastUsedCategoryId: z.number().int().optional(),
  lastUsedAccountId: z.number().int().optional(),
});

export const payeesResponseSchema = z.object({
  payees: z.array(payeeWithSuggestionSchema),
});

export type PayeeWithSuggestion = z.infer<typeof payeeWithSuggestionSchema>;
export type PayeesResponse = z.infer<typeof payeesResponseSchema>;

const QuerySchema = z.object({
  budgetId: z.coerce.number().int().positive().optional(),
});

export const GET = route({ query: QuerySchema, response: payeesResponseSchema })(async ({ user, query }) => {
  const budgets = await getUserBudgets(user.id);
  const budget = query.budgetId ? budgets.find(b => b.id === query.budgetId) : budgets[0];
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const payees = await getPayees(user.id, budget.id);
  return { payees };
});
