import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { getUserActiveBudget, getAccounts, getCategories } from '@my-hub/shared/services';
import { AccountTypes } from '@my-hub/shared/constants';
import { supportedCurrencySchema } from '../../currency.schema';
import { categoryIconSchema, categoryColorSchema } from '../../shared.schema';

export const transactionFormAccountSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  type: z.enum(AccountTypes),
  currency: supportedCurrencySchema,
});

export const transactionFormCategorySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  icon: categoryIconSchema,
  color: categoryColorSchema,
  groupId: z.number().int().nullable(),
});

export const transactionFormDataResponseSchema = z.object({
  currency: supportedCurrencySchema,
  accounts: z.array(transactionFormAccountSchema),
  categories: z.array(transactionFormCategorySchema),
});

export type TransactionFormDataResponse = z.infer<typeof transactionFormDataResponseSchema>;

export const GET = route({ response: transactionFormDataResponseSchema })(async ({ user }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const budgetId = budget.id;

  const [accounts, categories] = await Promise.all([getAccounts(user.id, budgetId), getCategories(user.id, budgetId)]);

  return {
    currency: budget.defaultCurrency,
    accounts: accounts.map(a => ({ id: a.id, name: a.name, type: a.type, currency: a.currency })),
    categories: categories.map(c => ({
      id: c.id,
      name: c.name,
      icon: c.icon ?? null,
      color: c.color ?? null,
      groupId: c.groupId ?? null,
    })),
  };
});
