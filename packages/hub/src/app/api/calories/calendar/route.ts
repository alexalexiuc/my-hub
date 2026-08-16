import { route } from '@/lib/api/route';
import { getDailySummariesForRange, getCalorieProfile, getLatestMeasurementsPerType } from '@my-hub/shared/services';
import { dayCalorieTargets, latestWeightKg, toUTCDateStr } from '@my-hub/shared/utils';
import { CalendarQuerySchema, CalendarResponseSchema } from './calendar.schemas';

/**
 * GET /api/calories/calendar?month=YYYY-MM
 * Per-day kcal/macro totals for the whole month plus that day's target (gym-day bonus included),
 * resolved the same way as Progress and the weekly menu so a day doesn't read differently here.
 */
export const GET = route({ query: CalendarQuerySchema, response: CalendarResponseSchema })(async ({ user, query }) => {
  const [year, monthNum] = query.month.split('-').map(Number);
  const start = `${query.month}-01`;
  const end = toUTCDateStr(new Date(Date.UTC(year ?? 2000, monthNum ?? 1, 0)));

  const [summaries, profile, latestMeasurements] = await Promise.all([
    getDailySummariesForRange(user.id, start, end),
    getCalorieProfile(user.id),
    getLatestMeasurementsPerType(user.id),
  ]);
  const weightKg = latestWeightKg(latestMeasurements);

  const days = summaries.map(summary => {
    const { target, min, isGymDay } = dayCalorieTargets(profile, weightKg, summary.date);
    return { ...summary, target, min, isGymDay };
  });

  return { days };
});
