import {
  getCalorieProfile,
  getLatestMeasurementsPerType,
  getMealsForDateRange,
  getMeasurements,
} from '@my-hub/shared/services';
import { rowToProfile, profileToTargets } from '../models/profile';
import { ReadResourceCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { today, daysAgo } from '../../shared/dateUTils';
import { resourceResponse } from '../../shared/resourcesUtils';

export const getHistoryResource: ReadResourceCallback = async (uri, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;

  const endDate = today();
  const startDate = daysAgo(6); // 7 days inclusive

  const [weekRows, allMeasurements, profileRow, latestMeasurements] = await Promise.all([
    getMealsForDateRange(userId, startDate, endDate),
    getMeasurements(userId, { dateFrom: startDate, dateTo: endDate, limit: 100 }),
    getCalorieProfile(userId),
    getLatestMeasurementsPerType(userId),
  ]);

  const weightLogs = allMeasurements.filter((m) => m.typeKey === 'weight');
  const profile = profileRow ? rowToProfile(profileRow) : {};
  const weightM = latestMeasurements.find((m) => m.typeKey === 'weight');
  const targets = profileToTargets(profile, weightM?.value);

  const days: { date: string; total_kcal: number; meal_count: number }[] = [];
  const cur = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  while (cur <= end) {
    const dateStr = cur.toISOString().split('T')[0]!;
    const dayMeals = weekRows.filter((r) => r.date === dateStr);
    const total_kcal = dayMeals.reduce((s, m) => s + (m.kcal ?? 0), 0);
    days.push({ date: dateStr, total_kcal, meal_count: dayMeals.length });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return resourceResponse(uri, {
    period: { start: startDate, end: endDate },
    goal_calories: targets.goalCalories,
    max_calories: targets.maxCalories,
    daily_intake: days,
    weight_logs: weightLogs.map((m) => ({
      date: m.date,
      value: m.value,
      unit: m.typeUnit,
    })),
  });
};
