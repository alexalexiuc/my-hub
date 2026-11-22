import { route } from '@/lib/api/route';
import { getDailySummariesForRange, getDayTargetsForRange, getMenuStatusForRange } from '@my-hub/shared/services';
import { monthEndStr, shiftDateStr } from '@my-hub/shared/utils';
import { CalendarQuerySchema, CalendarResponseSchema } from './calendar.schemas';

/** Longest explicit range served — a quarter. Longer views page by month. */
const MAX_RANGE_DAYS = 92;

/**
 * GET /api/calories/calendar?month=YYYY-MM  (or ?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD)
 * Per-day kcal/macro totals for the whole month plus that day's range (gym-day bonus included;
 * frozen once the day is over, see `getDayTargetsForRange`) and weekly-menu status, so a day
 * reads the same here as on Progress, the weekly menu and in the reports.
 */
export const GET = route({ query: CalendarQuerySchema, response: CalendarResponseSchema })(async ({ user, query }) => {
  // The schema guarantees one of the two forms; a range is clipped rather than refused.
  const start = query.month ? `${query.month}-01` : query.dateFrom!;
  const requestedEnd = query.month ? monthEndStr(query.month) : query.dateTo!;
  const cap = shiftDateStr(start, MAX_RANGE_DAYS - 1);
  const end = requestedEnd < cap ? requestedEnd : cap;

  const [summaries, dayTargets, menuStatuses] = await Promise.all([
    getDailySummariesForRange(user.id, start, end),
    getDayTargetsForRange(user.id, start, end),
    getMenuStatusForRange(user.id, start, end),
  ]);

  const days = summaries.map(summary => {
    const { hasMenu = false, logged: menuLogged = false } = menuStatuses[summary.date] ?? {};
    return { ...summary, ...dayTargets.get(summary.date)!, hasMenu, menuLogged };
  });

  return { days };
});
