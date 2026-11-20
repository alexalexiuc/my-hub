import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { DrawdownRanges } from '@my-hub/shared/constants';
import { getPortfolioDrawdown, getUserActiveBudget, type PortfolioDrawdown } from '@my-hub/shared/services';

export type PortfolioDrawdownResponse = { drawdown: PortfolioDrawdown | null };

const QuerySchema = z.object({
  range: z
    .enum(Object.keys(DrawdownRanges) as [keyof typeof DrawdownRanges, ...(keyof typeof DrawdownRanges)[]])
    .default('3M'),
});

export const GET = route({ query: QuerySchema })(async ({ user, query }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const response: PortfolioDrawdownResponse = { drawdown: await getPortfolioDrawdown(user.id, budget.id, query.range) };
  return response;
});
