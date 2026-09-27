import { route } from '@/lib/api/route';
import { getVacationBalance } from '@my-hub/shared/services';
import { VacationBalanceQuerySchema } from '../vacation.schemas';

/**
 * GET /api/vacation/balance?date=YYYY-MM-DD&includeDraftRules=true
 * Projected leave balance at the end of a date, per rule-set bucket, planned leave included.
 */
export const GET = route({ query: VacationBalanceQuerySchema })(async ({ user, query }) =>
  getVacationBalance(user.id, query),
);
