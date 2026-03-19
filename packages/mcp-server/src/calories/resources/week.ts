import { getCalorieProfile, getLatestMeasurementsPerType, getMealsForDateRange } from '@my-hub/shared/services';
import { rowToMealEntry } from '../models/meals';
import { rowToProfile, profileToTargets } from '../models/profile';
import { sumMeals, getWeekBounds } from '../models/summary';
import { ReadResourceCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { today } from '../../shared/dateUTils';
import { resourceResponse } from '../../shared/resourcesUtils';

export const getWeekResource: ReadResourceCallback = async (uri, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;

  const { start, end } = getWeekBounds(today());

  const [profileRow, weekRows, latestMeasurements] = await Promise.all([
    getCalorieProfile(userId),
    getMealsForDateRange(userId, start, end),
    getLatestMeasurementsPerType(userId),
  ]);

  const profile = profileRow ? rowToProfile(profileRow) : {};
  const weightM = latestMeasurements.find((m) => m.typeKey === 'weight');
  const targets = profileToTargets(profile, weightM?.value);
  const goalCal = targets.goalCalories;

  const days = [];
  const current = new Date(start + 'T00:00:00Z');
  const endDate = new Date(end + 'T00:00:00Z');

  while (current <= endDate) {
    const dateStr = current.toISOString().split('T')[0]!;
    const dayMeals = weekRows.filter((r) => r.date === dateStr).map(rowToMealEntry);
    const totals = sumMeals(dayMeals);
    days.push({ date: dateStr, ...totals, meal_count: dayMeals.length });
    current.setUTCDate(current.getUTCDate() + 1);
  }

  const totalCalories = days.reduce((s, d) => s + d.calories, 0);
  const daysWithData = days.filter((d) => d.meal_count > 0).length;
  const weeklyAverage = daysWithData > 0 ? Math.round(totalCalories / daysWithData) : 0;
  const weeklyTarget = goalCal !== null ? goalCal * 7 : null;

  return resourceResponse(uri, {
    week: { start, end },
    days,
    weekly_total_calories: totalCalories,
    weekly_average_calories: weeklyAverage,
    goal_calories: goalCal,
    min_calories: targets.minCalories,
    max_calories: targets.maxCalories,
    weekly_target: weeklyTarget,
    weekly_remaining: weeklyTarget !== null ? weeklyTarget - totalCalories : null,
  });
};
