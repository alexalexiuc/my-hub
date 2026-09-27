import { route } from '@/lib/api/route';
import { getVacationCalendar } from '@my-hub/shared/services';
import { buildMonthGridDays } from '@my-hub/shared/utils';
import { VacationCalendarQuerySchema } from '../vacation.schemas';

/**
 * GET /api/vacation/calendar?month=YYYY-MM&includeDraftRules=true
 * Per-day leave value for every day of the month grid (full Monday–Sunday weeks), plus the
 * average daily rate per start month and data-quality warnings.
 */
export const GET = route({ query: VacationCalendarQuerySchema })(async ({ user, query }) => {
  const grid = buildMonthGridDays(query.month);
  return getVacationCalendar(user.id, {
    from: grid[0]!.date,
    to: grid.at(-1)!.date,
    includeDraftRules: query.includeDraftRules,
  });
});
