import {
  getCalorieProfile,
  getLatestMeasurementsPerType,
  getMealsForDateRange,
  getMeasurements,
} from '@my-hub/shared/services';
import { rowToProfile, profileToTargets } from './profile';
import { rowToMealEntry } from './meals';
import { sumMeals } from './summary';
import { MeasurementTypes } from '@my-hub/shared/constants';

export async function buildHistoryPeriod(userId: string, startDate: string, endDate: string) {
  const [mealRows, allMeasurements, profileRow, latestMeasurements] = await Promise.all([
    getMealsForDateRange(userId, startDate, endDate),
    getMeasurements(userId, { dateFrom: startDate, dateTo: endDate, limit: 500 }),
    getCalorieProfile(userId),
    getLatestMeasurementsPerType(userId),
  ]);

  const weightLogs = allMeasurements.filter((m) => m.typeKey === MeasurementTypes.Weight);
  const profile = profileRow ? rowToProfile(profileRow) : {};
  const weightM = latestMeasurements.find((m) => m.typeKey === MeasurementTypes.Weight);
  const targets = profileToTargets(profile, weightM?.value);

  const days = [];
  const cur = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');

  while (cur <= end) {
    const dateStr = cur.toISOString().split('T')[0]!;
    const dayMeals = mealRows.filter((r) => r.date === dateStr).map(rowToMealEntry);
    const totals = sumMeals(dayMeals);
    days.push({ date: dateStr, ...totals, meal_count: dayMeals.length });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  const totalCalories = days.reduce((s, d) => s + d.calories, 0);
  const daysWithData = days.filter((d) => d.meal_count > 0).length;
  const avgDailyCalories = daysWithData > 0 ? Math.round(totalCalories / daysWithData) : 0;
  const periodTarget = targets.goalCalories !== null ? targets.goalCalories * days.length : null;

  return {
    period: { start: startDate, end: endDate },
    days,
    weight_logs: weightLogs.map((m) => ({ date: m.date, value: m.value, unit: m.typeUnit })),
    total_calories: totalCalories,
    average_daily_calories: avgDailyCalories,
    goal_calories: targets.goalCalories,
    min_calories: targets.minCalories,
    max_calories: targets.maxCalories,
    period_target: periodTarget,
    period_remaining: periodTarget !== null ? periodTarget - totalCalories : null,
  };
}
