import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { getUserActiveBudget, getAccounts, getAccountById, getCategories } from '@my-hub/shared/services';
import { AccountTypes } from '@my-hub/shared/constants';
import { supportedCurrencySchema } from '../../currency.schema';
import { categoryIconSchema, categoryColorSchema } from '../../shared.schema';

export const transactionFormAccountSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  type: z.enum(AccountTypes),
  currency: supportedCurrencySchema,
  archived: z.boolean(),
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

const formDataQuerySchema = z.object({
  accountId: z.coerce.number().int().positive().optional(),
  toAccountId: z.coerce.number().int().positive().optional(),
});

export const GET = route({ query: formDataQuerySchema, response: transactionFormDataResponseSchema })(async ({
  user,
  query,
}) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const budgetId = budget.id;

  const [activeAccounts, categories] = await Promise.all([
    getAccounts(user.id, budgetId),
    getCategories(user.id, budgetId),
  ]);

  // When editing a transaction, include its archived account(s) even though they're no longer active
  const activeIds = new Set(activeAccounts.map(a => a.id));
  const extraIds = [query?.accountId, query?.toAccountId].filter(
    (id): id is number => id != null && !activeIds.has(id),
  );
  const extraAccounts = (await Promise.all(extraIds.map(id => getAccountById(user.id, budgetId, id)))).filter(
    (a): a is NonNullable<typeof a> => a != null,
  );

  const allAccounts = [...activeAccounts, ...extraAccounts];

  return {
    currency: budget.defaultCurrency,
    accounts: allAccounts.map(a => ({
      id: a.id,
      name: a.name,
      type: a.type,
      currency: a.currency,
      archived: a.archived,
    })),
    categories: categories.map(c => ({
      id: c.id,
      name: c.name,
      icon: c.icon ?? null,
      color: c.color ?? null,
      groupId: c.groupId ?? null,
    })),
  };
});
