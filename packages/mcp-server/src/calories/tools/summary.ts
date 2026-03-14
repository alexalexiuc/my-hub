import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getCalorieProfile, getMealsForDate, getMealsForDateRange } from "@my-hub/shared/services";
import { MealType, MEAL_TYPE_FRACTIONS } from "../constants";
import { calculateTDEE, rowToProfile } from "./profile";
import { rowToMealEntry } from "./meals";

const yyyyMmDdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD");

function getWeekBounds(dateStr: string): { start: string; end: string } {
  const date = new Date(dateStr + "T00:00:00Z");
  const day = date.getUTCDay(); // 0=Sun
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    start: monday.toISOString().split("T")[0]!,
    end: sunday.toISOString().split("T")[0]!,
  };
}

const GetDailySummarySchema = z.object({
  date: yyyyMmDdSchema.optional().describe("Date to summarize (YYYY-MM-DD). Defaults to today."),
});

const GetWeeklySummarySchema = z.object({
  date: yyyyMmDdSchema
    .optional()
    .describe("Any date within the target week (YYYY-MM-DD). Defaults to today. Week runs Monday–Sunday."),
});

const GetRemainingSchema = z.object({
  date: yyyyMmDdSchema.optional().describe("Date to check (YYYY-MM-DD). Defaults to today."),
  meal_type: z
    .nativeEnum(MealType)
    .optional()
    .describe(
      "If provided, also shows typical calorie budget for that meal type based on common distribution (breakfast 25%, lunch 35%, dinner 30%, snacks 10%).",
    ),
});

type GetDailySummaryInput = z.infer<typeof GetDailySummarySchema>;
type GetWeeklySummaryInput = z.infer<typeof GetWeeklySummarySchema>;
type GetRemainingInput = z.infer<typeof GetRemainingSchema>;

export function registerSummaryTools(server: McpServer, userId: string) {
  server.registerTool(
    "calories_get_daily_summary",
    {
      description:
        "Get a full calorie and macro summary for a given day, broken down by meal. Also shows progress against the daily target.",
      inputSchema: GetDailySummarySchema.shape,
      annotations: { readOnlyHint: true },
    },
    async (input: GetDailySummaryInput) => {
      const today = new Date().toISOString().split("T")[0]!;
      const date = input.date ?? today;

      const [profileRow, dayRows] = await Promise.all([getCalorieProfile(userId), getMealsForDate(userId, date)]);

      const profile = profileRow ? rowToProfile(profileRow) : {};
      const { daily_calories } = calculateTDEE(profile);
      const meals = dayRows.map(rowToMealEntry);
      const totals = sumMeals(meals);
      const remaining = daily_calories !== null ? daily_calories - totals.calories : null;

      return toolResponse({
        date,
        meals,
        totals: {
          calories: totals.calories,
          protein_g: totals.protein_g || null,
          carbs_g: totals.carbs_g || null,
          fat_g: totals.fat_g || null,
          meal_count: meals.length,
        },
        daily_target: daily_calories,
        remaining_calories: remaining,
        goal_met: daily_calories !== null ? totals.calories >= daily_calories : null,
      });
    },
  );

  server.registerTool(
    "calories_get_weekly_summary",
    {
      description:
        "Get a calorie summary for each day of the week (Mon–Sun) containing the given date. Shows daily totals and weekly average vs target.",
      inputSchema: GetWeeklySummarySchema.shape,
      annotations: { readOnlyHint: true },
    },
    async (input: GetWeeklySummaryInput) => {
      const today = new Date().toISOString().split("T")[0]!;
      const { start, end } = getWeekBounds(input.date ?? today);

      const [profileRow, weekRows] = await Promise.all([
        getCalorieProfile(userId),
        getMealsForDateRange(userId, start, end),
      ]);

      const profile = profileRow ? rowToProfile(profileRow) : {};
      const { daily_calories } = calculateTDEE(profile);

      // Build day-by-day summary for Mon–Sun
      const days = [];
      const current = new Date(start + "T00:00:00Z");
      const endDate = new Date(end + "T00:00:00Z");

      while (current <= endDate) {
        const dateStr = current.toISOString().split("T")[0]!;
        const dayMeals = weekRows.filter((r) => r.date === dateStr).map(rowToMealEntry);
        const totals = sumMeals(dayMeals);
        days.push({ date: dateStr, ...totals, meal_count: dayMeals.length });
        current.setUTCDate(current.getUTCDate() + 1);
      }

      const totalCalories = days.reduce((s, d) => s + d.calories, 0);
      const daysWithData = days.filter((d) => d.meal_count > 0).length;
      const weeklyAverage = daysWithData > 0 ? Math.round(totalCalories / daysWithData) : 0;
      const weeklyTarget = daily_calories !== null ? daily_calories * 7 : null;

      return toolResponse({
        week: { start, end },
        days,
        weekly_total_calories: totalCalories,
        weekly_average_calories: weeklyAverage,
        daily_target: daily_calories,
        weekly_target: weeklyTarget,
        weekly_remaining: weeklyTarget !== null ? weeklyTarget - totalCalories : null,
      });
    },
  );

  server.registerTool(
    "calories_get_remaining",
    {
      description:
        "Get remaining calories for the day based on the daily target and what has been logged so far. Optionally shows budget for a specific upcoming meal.",
      inputSchema: GetRemainingSchema.shape,
      annotations: { readOnlyHint: true },
    },
    async (input: GetRemainingInput) => {
      const today = new Date().toISOString().split("T")[0]!;
      const date = input.date ?? today;

      const [profileRow, dayRows] = await Promise.all([getCalorieProfile(userId), getMealsForDate(userId, date)]);

      const profile = profileRow ? rowToProfile(profileRow) : {};
      const { daily_calories } = calculateTDEE(profile);
      const totals = sumMeals(dayRows.map(rowToMealEntry));
      const remaining = daily_calories !== null ? daily_calories - totals.calories : null;

      const meal_budget =
        input.meal_type && daily_calories !== null
          ? Math.round(daily_calories * MEAL_TYPE_FRACTIONS[input.meal_type as MealType])
          : null;

      return toolResponse({
        date,
        calories_consumed: totals.calories,
        daily_target: daily_calories,
        remaining_calories: remaining,
        over_budget: remaining !== null ? remaining < 0 : null,
        meal_type: input.meal_type ?? null,
        suggested_meal_budget: meal_budget,
      });
    },
  );
}

function sumMeals(
  meals: {
    calories: number;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
  }[],
) {
  return {
    calories: meals.reduce((s, m) => s + m.calories, 0),
    protein_g: meals.reduce((s, m) => s + (m.protein_g ?? 0), 0),
    carbs_g: meals.reduce((s, m) => s + (m.carbs_g ?? 0), 0),
    fat_g: meals.reduce((s, m) => s + (m.fat_g ?? 0), 0),
  };
}

function toolResponse(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
  };
}
