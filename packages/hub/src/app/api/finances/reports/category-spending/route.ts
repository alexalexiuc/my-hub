import { route, routeHttpError } from '@/lib/api/route';
import { getUserActiveBudget, getCategorySpending } from '@my-hub/shared/services';
import { monthToDateRange, yearMonthRange } from '@my-hub/shared/utils';
import { categorySpendingQuerySchema, categorySpendingResponseSchema } from './category-spending.schema';
import type { CategorySpendingData } from './category-spending.schema';

/** Expense totals per category for a calendar year, highest spend first. */
export const GET = route({ query: categorySpendingQuerySchema, response: categorySpendingResponseSchema })(async ({
  user,
  query,
}) => {
  const year = query.year ?? new Date().getUTCFullYear();

  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const { monthFrom, monthTo } = yearMonthRange(year);
  const spending = await getCategorySpending(user.id, budget.id, `${monthFrom}-01`, monthToDateRange(monthTo).toDate);

  const data: CategorySpendingData = {
    currency: budget.defaultCurrency,
    year,
    totalSpent: spending.totalSpent,
    categories: spending.categories,
  };
  return data;
});
