import { route, routeHttpError } from '@/lib/api/route';
import { getUserActiveBudget, getAccounts, getCategories } from '@my-hub/shared/services';
import { transactionFormDataResponseSchema } from '../../contracts';

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
