import { route } from '@/lib/api/route';
import {
  getDailySummariesForRange,
  getCalorieProfile,
  getLatestMeasurementsPerType,
  getMenuStatusForRange,
} from '@my-hub/shared/services';
import { dayCalorieTargets, latestWeightKg, monthEndStr, shiftDateStr } from '@my-hub/shared/utils';
import { CalendarQuerySchema, CalendarResponseSchema } from './calendar.schemas';

/** Longest explicit range served — a quarter. Longer views page by month. */
const MAX_RANGE_DAYS = 92;

/**
 * GET /api/calories/calendar?month=YYYY-MM  (or ?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD)
 * Per-day kcal/macro totals for the whole month plus that day's target (gym-day bonus included)
 * and weekly-menu status, resolved the same way as Progress and the weekly menu so a day doesn't
 * read differently here.
 */
export const GET = route({ query: CalendarQuerySchema, response: CalendarResponseSchema })(async ({ user, query }) => {
  // The schema guarantees one of the two forms; a range is clipped rather than refused.
  const start = query.month ? `${query.month}-01` : query.dateFrom!;
  const requestedEnd = query.month ? monthEndStr(query.month) : query.dateTo!;
  const cap = shiftDateStr(start, MAX_RANGE_DAYS - 1);
  const end = requestedEnd < cap ? requestedEnd : cap;

  const [summaries, profile, latestMeasurements, menuStatuses] = await Promise.all([
    getDailySummariesForRange(user.id, start, end),
    getCalorieProfile(user.id),
    getLatestMeasurementsPerType(user.id),
    getMenuStatusForRange(user.id, start, end),
  ]);
  const weightKg = latestWeightKg(latestMeasurements);

  const days = summaries.map(summary => {
    const { target, min, isGymDay } = dayCalorieTargets(profile, weightKg, summary.date);
    const { hasMenu = false, logged: menuLogged = false } = menuStatuses[summary.date] ?? {};
    return { ...summary, target, min, isGymDay, hasMenu, menuLogged };
  });

  return { days };
});
