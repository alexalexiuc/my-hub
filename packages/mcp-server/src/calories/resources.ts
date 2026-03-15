import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getCalorieProfile,
  getLatestMeasurementsPerType,
  getMealsForDate,
  getMealsForDateRange,
  getMeasurements,
} from '@my-hub/shared/services';
import { profileToTargets, rowToProfile } from './tools/profile';
import { rowToMealEntry } from './tools/meals';

function today(): string {
  return new Date().toISOString().split('T')[0]!;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().split('T')[0]!;
}

function resourceResponse(payload: unknown) {
  return {
    contents: [
      {
        uri: '',
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
        'Current calorie profile including TDEE, goal targets (goal_calories, min_calories, max_calories), and latest body measurements. Read this first to understand the user\'s setup.',
      mimeType: 'application/json',
    },
    async (_uri, extra) => {
      const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
      if (!userId) throw new Error('Authentication required');

      const [profileRow, latestMeasurements] = await Promise.all([
        getCalorieProfile(userId),
        getLatestMeasurementsPerType(userId),
      ]);

      const profile = profileRow ? rowToProfile(profileRow) : {};
      const heightM = latestMeasurements.find((m) => m.typeKey === 'height');
      const weightM = latestMeasurements.find((m) => m.typeKey === 'weight');
      const targets = profileToTargets(profile, heightM?.value, weightM?.value);

      return resourceResponse({
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
    async (_uri, extra) => {
      const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
      if (!userId) throw new Error('Authentication required');

      const date = today();
      const [profileRow, dayRows, latestMeasurements] = await Promise.all([
        getCalorieProfile(userId),
        getMealsForDate(userId, date),
        getLatestMeasurementsPerType(userId),
      ]);

      const profile = profileRow ? rowToProfile(profileRow) : {};
      const heightM = latestMeasurements.find((m) => m.typeKey === 'height');
      const weightM = latestMeasurements.find((m) => m.typeKey === 'weight');
      const targets = profileToTargets(profile, heightM?.value, weightM?.value);

      const meals = dayRows.map(rowToMealEntry);
      const totalKcal = meals.reduce((s, m) => s + m.calories, 0);
      const totalProtein = meals.reduce((s, m) => s + (m.protein_g ?? 0), 0);
      const totalCarbs = meals.reduce((s, m) => s + (m.carbs_g ?? 0), 0);
      const totalFat = meals.reduce((s, m) => s + (m.fat_g ?? 0), 0);
      const maxCal = targets.maxCalories;
      const remaining = maxCal !== null ? maxCal - totalKcal : null;

      return resourceResponse({
        date,
        meals,
        totals: {
          calories: totalKcal,
          protein_g: totalProtein || null,
          carbs_g: totalCarbs || null,
          fat_g: totalFat || null,
          meal_count: meals.length,
        },
        goal_calories: targets.goalCalories,
        min_calories: targets.minCalories,
        max_calories: maxCal,
        remaining_calories: remaining,
        over_budget: remaining !== null ? remaining < 0 : null,
      });
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
    async (_uri, extra) => {
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
      const heightM = latestMeasurements.find((m) => m.typeKey === 'height');
      const weightM = latestMeasurements.find((m) => m.typeKey === 'weight');
      const targets = profileToTargets(profile, heightM?.value, weightM?.value);

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

      return resourceResponse({
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
}
