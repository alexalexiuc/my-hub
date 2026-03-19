import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getCalorieProfile,
  getLatestMeasurementsPerType,
  getMealsForDateRange,
  getMeasurements,
} from '@my-hub/shared/services';
import { rowToProfile, profileToTargets } from './models/profile';
import { rowToMealEntry } from './models/meals';
import { sumMeals, getWeekBounds } from './models/summary';
import { buildDailySummary } from './models/daily';

function today(): string {
  return new Date().toISOString().split('T')[0]!;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().split('T')[0]!;
}

function resourceResponse(uri: URL | string, payload: unknown) {
  return {
    contents: [
      {
        uri: uri.toString(),
        mimeType: 'application/json',
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

export function registerCaloriesResources(server: McpServer): void {
  /**
   * calories://profile
   * Current profile with TDEE, goal targets, and latest body measurements.
   */
  server.registerResource(
    'calories-profile',
    'calories://profile',
    {
      description:
        "Current calorie profile including TDEE, goal targets (goal_calories, min_calories, max_calories), and latest body measurements. Read this first to understand the user's setup.",
      mimeType: 'application/json',
    },
    async (uri, extra) => {
      const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
      if (!userId) throw new Error('Authentication required');

      const [profileRow, latestMeasurements] = await Promise.all([
        getCalorieProfile(userId),
        getLatestMeasurementsPerType(userId),
      ]);

      const profile = profileRow ? rowToProfile(profileRow) : {};
      const weightM = latestMeasurements.find((m) => m.typeKey === 'weight');
      const targets = profileToTargets(profile, weightM?.value);

      return resourceResponse(uri, {
        profile,
        calculated: {
          tdee: targets.tdee,
          goal_calories: targets.goalCalories,
          min_calories: targets.minCalories,
          max_calories: targets.maxCalories,
        },
        latest_measurements: latestMeasurements.map((m) => ({
          type: m.typeKey,
          label: m.typeLabel,
          value: m.value,
          unit: m.typeUnit,
          date: m.date,
        })),
      });
    },
  );

  /**
   * calories://today
   * All meals logged today plus a daily summary vs goal targets.
   */
  server.registerResource(
    'calories-today',
    'calories://today',
    {
      description:
        "All meals logged today with totals (kcal, macros) and progress against the user's daily calorie targets.",
      mimeType: 'application/json',
    },
    async (uri, extra) => {
      const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
      if (!userId) throw new Error('Authentication required');

      const summary = await buildDailySummary(userId, today());
      return resourceResponse(uri, summary);
    },
  );

  /**
   * calories://history
   * Last 7 days of calorie intake and weight measurements for trend analysis.
   */
  server.registerResource(
    'calories-history',
    'calories://history',
    {
      description:
        'Last 7 days of daily calorie intake totals and weight measurements. Useful for spotting trends and progress toward the weight goal.',
      mimeType: 'application/json',
    },
    async (uri, extra) => {
      const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
      if (!userId) throw new Error('Authentication required');

      const endDate = today();
      const startDate = daysAgo(6); // 7 days inclusive

      const [weekRows, allMeasurements, profileRow, latestMeasurements] = await Promise.all([
        getMealsForDateRange(userId, startDate, endDate),
        getMeasurements(userId, { dateFrom: startDate, dateTo: endDate, limit: 100 }),
        getCalorieProfile(userId),
        getLatestMeasurementsPerType(userId),
      ]);
      // Only keep weight entries for the history view
      const weightLogs = allMeasurements.filter((m) => m.typeKey === 'weight');

      const profile = profileRow ? rowToProfile(profileRow) : {};
      const weightM = latestMeasurements.find((m) => m.typeKey === 'weight');
      const targets = profileToTargets(profile, weightM?.value);

      // Build day-by-day calorie totals
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
    },
  );

  /**
   * calories://week
   * Calorie summary for each day of the current week (Mon–Sun).
   */
  server.registerResource(
    'calories-week',
    'calories://week',
    {
      description:
        'Calorie summary for each day of the current week (Mon–Sun). Shows daily totals, macros, and weekly average vs target.',
      mimeType: 'application/json',
    },
    async (uri, extra) => {
      const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
      if (!userId) throw new Error('Authentication required');

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
    },
  );
}
