import { route, routeHttpError } from '@/lib/api/route';
import {
  getPortfolio,
  getPortfolioValueHistory,
  getUserActiveBudget,
  type PortfolioHistoryPoint,
} from '@my-hub/shared/services';

export type PortfolioHistoryResponse = { points: PortfolioHistoryPoint[] };

export const GET = route(async ({ user }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });
  const portfolio = await getPortfolio(user.id, budget.id);
  if (!portfolio) routeHttpError(404, { error: 'Portfolio not found' });

  const points = await getPortfolioValueHistory(user.id, budget.id, portfolio.id);
  const response: PortfolioHistoryResponse = { points };
  return response;
});
