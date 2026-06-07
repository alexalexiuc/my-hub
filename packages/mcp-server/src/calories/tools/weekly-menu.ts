import { z } from 'zod';
import {
  createWeeklyMenu,
  getWeeklyMenuByWeek,
  getWeeklyMenus,
  getCalorieProfile,
  getLatestMeasurementsPerType,
  updateWeeklyMenuMeal,
  getWeeklyMenu,
  addMealToMenu,
} from '@my-hub/shared/services';
import { MealTypes, DaysOfWeek, DAY_LABELS_SHORT, MeasurementTypes } from '@my-hub/shared/constants';
import type { DayOfWeek } from '@my-hub/shared/constants';
import { toolResponse } from '../../shared/toolsUtils';
import { yyyyMmDdSchema } from '../../shared/schemas';
import type { ToolHandler } from '../../shared/types';
import { rowToProfile, profileToTargets } from '../models/profile';
import { localDateString, startOfWeekMonday, dateToString } from '@my-hub/shared/utils';

/** Convert a YYYY-MM-DD date string to day-of-week in Mon=0 … Sun=6 format. */
function dayOfWeekMon0(dateStr: string): number {
  const jsDay = new Date(dateStr + 'T00:00:00').getDay(); // 0=Sun
  return (jsDay + 6) % 7;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const MenuMealSchema = z.object({
  dayOfWeek: z
    .number()
    .int()
    .min(0)
    .max(6)
    .describe('Day of week: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday'),
  mealType: z
    .enum([
      MealTypes.Breakfast,
      MealTypes.Lunch,
      MealTypes.Dinner,
      MealTypes.Snack,
      MealTypes.PreWorkout,
      MealTypes.PostWorkout,
    ])
    .describe('breakfast | lunch | dinner | snack | pre_workout | post_workout'),
  description: z.string().describe('What to eat, e.g. "Grilled salmon with quinoa and broccoli"'),
  kcal: z.number().int().positive().optional().describe('Estimated calories'),
  proteinG: z.number().positive().optional().describe('Protein in grams'),
  carbsG: z.number().positive().optional().describe('Carbohydrates in grams'),
  fatG: z.number().positive().optional().describe('Fat in grams'),
});

export const CreateWeeklyMenuSchema = z.object({
  weekStart: yyyyMmDdSchema.describe(
    'The Monday of the target week in YYYY-MM-DD format. Use the upcoming Monday for "next week", or the current Monday for "this week".',
  ),
  title: z.string().optional().describe('Optional menu title, e.g. "High protein week"'),
  notes: z.string().optional().describe('Optional notes or summary for the week'),
  meals: z
    .array(MenuMealSchema)
    .min(1)
    .describe(
      "Planned meals for the week. For the current week, only include meals from today's day of week onwards (check planFromDayOfWeek in the tool response context). For future weeks, include all 7 days. Always include breakfast, lunch, dinner, and snack for each planned day.",
    ),
});

export const GetWeeklyMenuSchema = z.object({
  weekStart: yyyyMmDdSchema
    .optional()
    .describe('The Monday of the week to retrieve (YYYY-MM-DD). Omit to list all menus.'),
});

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const createWeeklyMenuTool: ToolHandler<typeof CreateWeeklyMenuSchema.shape> = async (input, context) => {
  const { userId } = context;

  // Compute today's date and day-of-week in the user's timezone
  const todayDate = localDateString(context.timezone);
  const todayDayOfWeek = dayOfWeekMon0(todayDate);
  const currentWeekStart = dateToString(startOfWeekMonday(new Date(todayDate + 'T00:00:00')));
  const isCurrentWeek = input.weekStart === currentWeekStart;
  // For the current week, only plan from today onwards; for future weeks, plan all 7 days
  const planFromDayOfWeek = isCurrentWeek ? todayDayOfWeek : 0;

  // Fetch the user's calorie profile and latest weight to compute their daily targets
  const [profileRow, latestMeasurements] = await Promise.all([
    getCalorieProfile(userId),
    getLatestMeasurementsPerType(userId),
  ]);

  const profile = profileRow ? rowToProfile(profileRow) : {};
  const weightM = latestMeasurements.find(m => m.typeKey === MeasurementTypes.Weight);
  const targets = profileToTargets(profile, weightM?.value);

  // Gym days from profile — used to label training vs rest days in the response
  const gymDays: number[] = profile.gymDays ?? [];

  // Validate that planned meals respect the user's daily calorie targets
  const warnings: string[] = [];
  if (targets.maxCalories !== null || targets.minCalories !== null) {
    // Group meals by day and sum kcal
    const dailyKcal: Record<number, number> = {};
    for (const m of input.meals) {
      dailyKcal[m.dayOfWeek] = (dailyKcal[m.dayOfWeek] ?? 0) + (m.kcal ?? 0);
    }

    for (const [day, kcal] of Object.entries(dailyKcal)) {
      if (kcal === 0) continue;
      if (targets.maxCalories !== null && kcal > targets.maxCalories) {
        warnings.push(`Day ${day}: ${kcal} kcal exceeds max target of ${targets.maxCalories} kcal`);
      }
      if (targets.minCalories !== null && kcal < targets.minCalories) {
        warnings.push(`Day ${day}: ${kcal} kcal is below min target of ${targets.minCalories} kcal`);
      }
    }
  }

  const menu = await createWeeklyMenu({
    userId,
    weekStart: input.weekStart,
    title: input.title ?? null,
    notes: input.notes ?? null,
    meals: input.meals.map(m => ({
      dayOfWeek: m.dayOfWeek as (typeof DaysOfWeek)[keyof typeof DaysOfWeek],
      mealType: m.mealType,
      description: m.description,
      kcal: m.kcal ?? null,
      protein: m.proteinG ?? null,
      carbs: m.carbsG ?? null,
      fat: m.fatG ?? null,
    })),
  });

  return toolResponse({
    menuId: menu.menuId,
    weekStart: menu.weekStart,
    title: menu.title,
    totalMeals: menu.meals.length,
    todayDate,
    todayDayOfWeek,
    planFromDayOfWeek,
    noProfile: !profileRow,
    noTargets: !!profileRow && targets.maxCalories === null && targets.minCalories === null,
    userTargets: profileRow
      ? {
          goalType: profile.goalType ?? null,
          dailyCalories: {
            min: targets.minCalories,
            goal: targets.goalCalories,
            max: targets.maxCalories,
          },
          macros: {
            proteinG: profileRow.goalProtein ?? null,
            carbsG: profileRow.goalCarbs ?? null,
            fatG: profileRow.goalFat ?? null,
          },
          gymDays: gymDays.length > 0 ? gymDays : null,
        }
      : null,
    warnings: warnings.length > 0 ? warnings : null,
    message: !profileRow
      ? `Weekly menu saved for ${menu.weekStart} as a balanced default — no calorie profile is set so meals were not tailored to specific targets. Suggest the user sets up their profile under Calories → Settings.`
      : `Weekly menu saved for ${menu.weekStart}. The user can view it in the hub under Calories → Weekly Menu.${isCurrentWeek && planFromDayOfWeek > 0 ? ` Only planned from ${DAY_LABELS_SHORT[planFromDayOfWeek as DayOfWeek]} (today) onwards — past days were skipped.` : ''}${gymDays.length > 0 ? ` Gym days (${gymDays.map(d => DAY_LABELS_SHORT[d as DayOfWeek]).join(', ')}) have been taken into account — plan higher calories/carbs on those days.` : ''}${warnings.length > 0 ? " Note: some days exceed the user's calorie targets — consider revising." : ''}`,
  });
};

export const getWeeklyMenuTool: ToolHandler<typeof GetWeeklyMenuSchema.shape> = async (input, context) => {
  const { userId } = context;

  const [profileRow, menuResult] = await Promise.all([
    getCalorieProfile(userId),
    input.weekStart ? getWeeklyMenuByWeek(userId, input.weekStart) : getWeeklyMenus(userId),
  ]);
  const gymDays: number[] = profileRow ? (rowToProfile(profileRow).gymDays ?? []) : [];
  const gymDaysOrNull = gymDays.length > 0 ? gymDays : null;

  if (input.weekStart) {
    if (!menuResult) return toolResponse({ menu: null, message: `No menu found for week of ${input.weekStart}.` });
    return toolResponse({ menu: menuResult, gymDays: gymDaysOrNull });
  }

  return toolResponse({ menus: menuResult, gymDays: gymDaysOrNull });
};

// ---------------------------------------------------------------------------
// Add meal
// ---------------------------------------------------------------------------

export const AddMealSchema = z.object({
  menuId: z.string().describe('The menuId of the weekly menu to add the meal to'),
  dayOfWeek: z.number().int().min(0).max(6).describe('Day of week: 0=Monday … 6=Sunday'),
  mealType: z
    .enum([
      MealTypes.Breakfast,
      MealTypes.Lunch,
      MealTypes.Dinner,
      MealTypes.Snack,
      MealTypes.PreWorkout,
      MealTypes.PostWorkout,
    ])
    .describe('Meal slot: breakfast | lunch | dinner | snack | pre_workout | post_workout'),
  description: z.string().describe('What to eat'),
  kcal: z.number().int().positive().optional().describe('Estimated calories'),
  proteinG: z.number().positive().optional().describe('Protein in grams'),
  carbsG: z.number().positive().optional().describe('Carbohydrates in grams'),
  fatG: z.number().positive().optional().describe('Fat in grams'),
});

export const addMealTool: ToolHandler<typeof AddMealSchema.shape> = async (input, context) => {
  const { userId } = context;

  const added = await addMealToMenu(userId, input.menuId, {
    dayOfWeek: input.dayOfWeek as DayOfWeek,
    mealType: input.mealType,
    description: input.description,
    kcal: input.kcal ?? null,
    protein: input.proteinG ?? null,
    carbs: input.carbsG ?? null,
    fat: input.fatG ?? null,
  });

  if (!added) {
    return toolResponse({
      success: false,
      message: `Could not add meal — menu not found or that slot already exists for day ${input.dayOfWeek}.`,
    });
  }

  const dayName = DAY_LABELS_SHORT[input.dayOfWeek as DayOfWeek];
  return toolResponse({
    success: true,
    added,
    message: `Added ${input.mealType} on ${dayName}: "${input.description}"${input.kcal ? ` (${input.kcal} kcal)` : ''}. Visible under Calories → Weekly Menu.`,
  });
};

// ---------------------------------------------------------------------------
// Swap meal
// ---------------------------------------------------------------------------

export const SwapMealSchema = z.object({
  menuId: z.string().describe('The menuId of the weekly menu to update'),
  dayOfWeek: z.number().int().min(0).max(6).describe('Day of week: 0=Monday … 6=Sunday'),
  mealType: z
    .enum([
      MealTypes.Breakfast,
      MealTypes.Lunch,
      MealTypes.Dinner,
      MealTypes.Snack,
      MealTypes.PreWorkout,
      MealTypes.PostWorkout,
    ])
    .describe('Which meal slot to replace: breakfast | lunch | dinner | snack | pre_workout | post_workout'),
  description: z.string().describe('The new meal description'),
  kcal: z.number().int().positive().optional().describe('Estimated calories for the new meal'),
  proteinG: z.number().positive().optional().describe('Protein in grams'),
  carbsG: z.number().positive().optional().describe('Carbohydrates in grams'),
  fatG: z.number().positive().optional().describe('Fat in grams'),
});

export const swapMealTool: ToolHandler<typeof SwapMealSchema.shape> = async (input, context) => {
  const { userId } = context;

  const menu = await getWeeklyMenu(userId, input.menuId);
  if (!menu) return toolResponse({ success: false, message: `Menu ${input.menuId} not found.` });

  const updated = await updateWeeklyMenuMeal(userId, input.menuId, input.dayOfWeek as DayOfWeek, input.mealType, {
    description: input.description,
    kcal: input.kcal ?? null,
    protein: input.proteinG ?? null,
    carbs: input.carbsG ?? null,
    fat: input.fatG ?? null,
  });

  if (!updated) {
    return toolResponse({
      success: false,
      message: `No ${input.mealType} found for day ${input.dayOfWeek} in menu ${input.menuId}.`,
    });
  }

  const dayName = DAY_LABELS_SHORT[input.dayOfWeek as DayOfWeek];
  return toolResponse({
    success: true,
    updated,
    message: `Swapped ${input.mealType} on ${dayName}: "${input.description}"${input.kcal ? ` (${input.kcal} kcal)` : ''}. The user can see the updated menu under Calories → Weekly Menu.`,
  });
};
