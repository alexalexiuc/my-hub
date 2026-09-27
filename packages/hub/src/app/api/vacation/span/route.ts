import { route } from '@/lib/api/route';
import { evaluateVacationSpan } from '@my-hub/shared/services';
import { VacationSpanQuerySchema } from '../vacation.schemas';

/**
 * GET /api/vacation/span?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&includeDraftRules=true
 * Totals for taking leave over a span: balance cost, net amount, net delta vs working, rest days.
 */
export const GET = route({ query: VacationSpanQuerySchema })(async ({ user, query }) =>
  evaluateVacationSpan(user.id, { ...query, allowDemo: true }),
);
