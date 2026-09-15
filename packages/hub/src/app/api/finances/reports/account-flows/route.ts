import { route, routeHttpError } from '@/lib/api/route';
import { getUserActiveBudget, getMonthlyAccountFlows } from '@my-hub/shared/services';
import { yearMonthRange } from '@my-hub/shared/utils';
import { accountFlowsQuerySchema, accountFlowsReportResponseSchema } from './account-flows.schema';
import type { AccountFlowsReportData } from './account-flows.schema';

/** Per-account money in/out for each month of a calendar year. */
export const GET = route({ query: accountFlowsQuerySchema, response: accountFlowsReportResponseSchema })(async ({
  user,
  query,
}) => {
  const year = query.year ?? new Date().getUTCFullYear();

  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const { monthFrom, monthTo } = yearMonthRange(year);
  const flows = await getMonthlyAccountFlows(user.id, budget.id, monthFrom, monthTo);

  const data: AccountFlowsReportData = {
    currency: budget.defaultCurrency,
    year,
    months: flows.months,
    accounts: flows.accounts,
  };
  return data;
});
