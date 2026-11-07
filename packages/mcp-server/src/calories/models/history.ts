import {
  getCalorieProfile,
  getLatestMeasurementsPerType,
  getMealsForDateRange,
  getMeasurements,
} from '@my-hub/shared/services';
import { dayTargetStatus } from '@my-hub/shared/utils';
import type { DayTargetProfileLike } from '@my-hub/shared/utils';
import type { MealEntry } from '../types';
import { rowToProfile, profileToTargets } from './profile';
import { rowToMealEntry } from './meals';
import { sumMeals } from './summary';
import { dayTargetFields } from './targets';
import { MeasurementTypes } from '@my-hub/shared/constants';

/**
 * Per-day totals for a date range, each judged against that day's own range (gym-day bonus
 * included), plus the period's totals. The pure half of `buildHistoryPeriod`.
 *
 * - `status` is `dayTargetStatus` for finished days only: today is still in progress, and judging
 *   it would call a day "under" at breakfast — the rule the Hub's adherence summary applies too.
 * - `periodTarget` is the sum of each day's own **ceiling** (max calories, or goal calories when no
 *   max is set, plus the gym-day bonus) — the same number every Hub screen holds a day against —
 *   and null when the profile can't produce one.
 *
 * @param meals    - Every meal in the range, any order.
 * @param weightKg - Latest weight, for TDEE-derived targets.
 * @param today    - YYYY-MM-DD in the user's timezone.
 */
export function summariseHistoryDays(
  meals: MealEntry[],
  profile: DayTargetProfileLike,
  weightKg: number | null | undefined,
  startDate: string,
  endDate: string,
  today: string,
) {
  const mealsByDate = new Map<string, MealEntry[]>();
  for (const meal of meals) mealsByDate.set(meal.date, [...(mealsByDate.get(meal.date) ?? []), meal]);

  const days = [];
  const cur = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  while (cur <= end) {
    const dateStr = cur.toISOString().split('T')[0]!;
    const dayMeals = mealsByDate.get(dateStr) ?? [];
    const totals = sumMeals(dayMeals);
    const dayTargets = dayTargetFields(profile, weightKg, dateStr);
    const status =
      dateStr < today
        ? dayTargetStatus({
            kcal: totals.calories,
            mealCount: dayMeals.length,
            target: dayTargets.dayTarget,
            min: dayTargets.dayMin,
          })
        : null;
    days.push({ date: dateStr, ...totals, mealCount: dayMeals.length, ...dayTargets, status });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  const totalCalories = days.reduce((s, d) => s + d.calories, 0);
  const daysWithData = days.filter(d => d.mealCount > 0).length;
  const periodTarget = days.every(d => d.dayTarget !== null) ? days.reduce((s, d) => s + (d.dayTarget ?? 0), 0) : null;

  return {
    days,
    totalCalories,
    averageDailyCalories: daysWithData > 0 ? Math.round(totalCalories / daysWithData) : 0,
    periodTarget,
    periodRemaining: periodTarget !== null ? periodTarget - totalCalories : null,
  };
}

/**
 * Per-day totals for a date range, each judged against that day's own range (gym-day bonus
 * included), plus weight logs and period totals. Backs `calories_get_history` and the
 * `calories://history-*` resources.
 *
 * @param today - YYYY-MM-DD in the user's timezone; days from it onwards get `status: null`.
 */
export async function buildHistoryPeriod(userId: string, startDate: string, endDate: string, today: string) {
  const [mealRows, allMeasurements, profileRow, latestMeasurements] = await Promise.all([
    getMealsForDateRange(userId, startDate, endDate),
    getMeasurements(userId, { dateFrom: startDate, dateTo: endDate, limit: 500 }),
    getCalorieProfile(userId),
    getLatestMeasurementsPerType(userId),
  ]);

  const weightLogs = allMeasurements.filter(m => m.typeKey === MeasurementTypes.Weight);
  const profile = profileRow ? rowToProfile(profileRow) : {};
  const weightM = latestMeasurements.find(m => m.typeKey === MeasurementTypes.Weight);
  const targets = profileToTargets(profile, weightM?.value);
  const { days, totalCalories, averageDailyCalories, periodTarget, periodRemaining } = summariseHistoryDays(
    mealRows.map(rowToMealEntry),
    profile,
    weightM?.value,
    startDate,
    endDate,
    today,
  );

  return {
    period: { start: startDate, end: endDate },
    days,
    weightLogs: weightLogs.map(m => ({ date: m.date, value: m.value, unit: m.typeUnit })),
    totalCalories,
    averageDailyCalories,
    goalCalories: targets.goalCalories,
    minCalories: targets.minCalories,
    maxCalories: targets.maxCalories,
    periodTarget,
    periodRemaining,
  };
}
