import { route, routeHttpError } from '@/lib/api/route';
import { getUserActiveBudget, getCashflowSummary } from '@my-hub/shared/services';
import { monthToDateRange, monthsBetweenStr, shiftMonthStr, yearMonthRange } from '@my-hub/shared/utils';
import { reportsQuerySchema, reportsResponseSchema } from './reports.schema';
import type { CashflowMonth, ReportsData } from './reports.schema';

/** Whole-budget income vs expenses for each month of a calendar year. */
export const GET = route({ query: reportsQuerySchema, response: reportsResponseSchema })(async ({ user, query }) => {
  const year = query.year ?? new Date().getUTCFullYear();

  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const { monthFrom, monthTo } = yearMonthRange(year);
  const summary = await getCashflowSummary(user.id, budget.id, `${monthFrom}-01`, monthToDateRange(monthTo).toDate);

  // getCashflowSummary only returns months that had activity — zero-fill so every month of the
  // year gets a bar and a table row.
  const byMonth = new Map(summary.byMonth.map(m => [m.month, m]));
  const monthCount = monthsBetweenStr(monthFrom, monthTo) + 1;
  const cashflow: CashflowMonth[] = Array.from({ length: monthCount }, (_, i) => {
    const month = shiftMonthStr(monthFrom, i);
    const entry = byMonth.get(month);
    return {
      month,
      income: Math.round((entry?.income ?? 0) * 100) / 100,
      expense: Math.round((entry?.expenses ?? 0) * 100) / 100,
    };
  });

  const data: ReportsData = { currency: budget.defaultCurrency, year, cashflow };
  return data;
});
