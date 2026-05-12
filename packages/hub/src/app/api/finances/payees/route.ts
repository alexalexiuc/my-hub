import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { getUserBudgets, getPayees } from '@my-hub/shared/services';
import { supportedCurrencySchema } from '../currency.schema';

export const payeeSuggestionSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  aliases: z.array(z.string()),
  description: z.string().nullable(),
  useCount: z.number().int(),
  lastUsedAt: z.string().nullable(),
  recentCategoryId: z.number().int().nullable(),
  recentAccountId: z.number().int().nullable(),
});

export const payeesResponseSchema = z.object({
  payees: z.array(payeeSuggestionSchema),
  currency: supportedCurrencySchema,
});

export type PayeeSuggestion = z.infer<typeof payeeSuggestionSchema>;
export type PayeesResponse = z.infer<typeof payeesResponseSchema>;

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
