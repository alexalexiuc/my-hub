import {
  getCalorieProfile,
  getMealsForDate,
  getLatestMeasurementsPerType,
  logMeal,
  getMeals,
  deleteMeal,
  findUserById,
} from '@my-hub/shared/services';
import { z } from 'zod';
import { MAX_MEAL_LIMIT, DEFAULT_MEAL_LIMIT } from '../constants';
import { rowToProfile, profileToTargets } from '../models/profile';
import { toolResponse } from '../../shared/toolsUtils';
import { yyyyMmDdSchema } from '../../shared/schemas';
import { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { omitNullish, localDateString, localHour } from '@my-hub/shared/utils';
import { rowToMealEntry } from '../models/meals';
import { MealEntry } from '../types';
import { MealTypes, MeasurementTypes } from '@my-hub/shared/constants';

export const MealItemSchema = z.object({
  name: z.string().describe('Name of the food item, e.g. "grilled chicken breast"'),
  calories: z.number().int().positive().describe('Estimated calories for this item'),
  proteinG: z.number().positive().optional().describe('Estimated protein in grams'),
  carbsG: z.number().positive().optional().describe('Estimated carbs in grams'),
  fatG: z.number().positive().optional().describe('Estimated fat in grams'),
});

export const LogMealSchema = z.object({
  description: z
    .string()
    .describe(
      'What was eaten — describe the meal as seen in the photo or as told by the user, e.g. "grilled chicken breast with rice and salad". If multiple foods are present, include them in a single call using the items array instead of making multiple calls.',
    ),
  items: z
    .array(MealItemSchema)
    .optional()
    .describe(
      'Individual food items that make up the meal. When the meal consists of multiple distinct foods (e.g. burger + fries + drink), list each one here so they are tracked separately. If provided, each item is logged as its own entry.',
    ),
  calories: z
    .number()
    .int()
    .positive()
    .describe(
      'Total estimated calorie content of the meal. If analyzing a photo, estimate based on visible portion sizes and typical nutritional values. When items are provided this should equal the sum of all item calories.',
    ),
  mealType: z
    .nativeEnum(MealTypes)
    .optional()
    .describe(
      'Type of meal: "breakfast" | "lunch" | "dinner" | "snack". If not specified, infer from the time of day or context.',
    ),
  date: yyyyMmDdSchema.optional().describe('Date of the meal (YYYY-MM-DD). Defaults to today.'),
  proteinG: z.number().positive().optional().describe('Estimated protein content in grams'),
  carbsG: z.number().positive().optional().describe('Estimated carbohydrate content in grams'),
  fatG: z.number().positive().optional().describe('Estimated fat content in grams'),
  notes: z.string().optional().describe('Any additional notes, e.g. "restaurant portion, may be larger than typical"'),
});

export const GetMealsSchema = z.object({
  date: yyyyMmDdSchema.optional().describe('Filter to a specific date (YYYY-MM-DD). Omit for all entries.'),
  mealType: z.nativeEnum(MealTypes).optional().describe('Filter by meal type'),
  limit: z
    .number()
    .int()
    .positive()
    .max(MAX_MEAL_LIMIT)
    .default(DEFAULT_MEAL_LIMIT)
    .optional()
    .describe(`Max entries to return (default: ${DEFAULT_MEAL_LIMIT}, max: ${MAX_MEAL_LIMIT})`),
  offset: z.number().int().min(0).default(0).optional().describe('Pagination offset. Defaults to 0.'),
});

export const DeleteMealSchema = z.object({
  mealId: z.string().describe('The mealId of the entry to delete'),
});

export const logMealTool: ToolCallback<typeof LogMealSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
  if (!userId) throw new Error('Authentication required');

  // Fetch user record first to resolve timezone for date/mealType inference
  const [profileRow, userRecord] = await Promise.all([getCalorieProfile(userId), findUserById(userId)]);
  const timezone = userRecord?.timezone ?? null;

  const date = input.date ?? localDateString(timezone);

  let { mealType } = input;
  if (!mealType) {
    const hour = localHour(timezone);
    if (hour < 10) mealType = MealTypes.Breakfast;
    else if (hour < 14) mealType = MealTypes.Lunch;
    else if (hour < 19) mealType = MealTypes.Dinner;
    else mealType = MealTypes.Snack;
  }

  // Determine items to log: individual items if provided, otherwise the whole meal as one entry
  const itemsToLog =
    input.items && input.items.length > 0
      ? input.items.map(item => ({
          description: item.name,
          kcal: item.calories,
          protein: item.proteinG ?? null,
          carbs: item.carbsG ?? null,
          fat: item.fatG ?? null,
        }))
      : [
          {
            description: input.description,
            kcal: input.calories,
            protein: input.proteinG ?? null,
            carbs: input.carbsG ?? null,
            fat: input.fatG ?? null,
          },
        ];

  const rows = await Promise.all(
    itemsToLog.map(item =>
      logMeal({
        mealId: crypto.randomUUID(),
        userId,
        date,
        mealType,
        description: item.description,
        kcal: item.kcal,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        notes: input.notes ?? null,
      }),
    ),
  );

  // Fetch remaining calories for the day (includes the meals just logged)
  const [dayRows, latestMeasurements] = await Promise.all([
    getMealsForDate(userId, date),
    getLatestMeasurementsPerType(userId),
  ]);

  const profile = profileRow ? rowToProfile(profileRow) : {};
  const weightM = latestMeasurements.find(m => m.typeKey === MeasurementTypes.Weight);
  const targets = profileToTargets(profile, weightM?.value);
  const maxCal = targets.maxCalories;
  const caloriesConsumed = dayRows.reduce((s, r) => s + (r.kcal ?? 0), 0);
  const remainingCalories = maxCal !== null ? maxCal - caloriesConsumed : null;

  const proteinConsumed = dayRows.reduce((s, r) => s + (r.protein ?? 0), 0);
  const carbsConsumed = dayRows.reduce((s, r) => s + (r.carbs ?? 0), 0);
  const fatConsumed = dayRows.reduce((s, r) => s + (r.fat ?? 0), 0);

  const goalProtein = profileRow?.goalProtein ?? null;
  const goalCarbs = profileRow?.goalCarbs ?? null;
  const goalFat = profileRow?.goalFat ?? null;

  const remaining = {
    caloriesConsumed,
    goalCalories: targets.goalCalories,
    minCalories: targets.minCalories,
    maxCalories: maxCal,
    remainingCalories,
    overBudget: remainingCalories !== null ? remainingCalories < 0 : null,
    macros: {
      proteinG: proteinConsumed,
      carbsG: carbsConsumed,
      fatG: fatConsumed,
      goalProteinG: goalProtein,
      goalCarbsG: goalCarbs,
      goalFatG: goalFat,
      remainingProteinG: goalProtein !== null ? goalProtein - proteinConsumed : null,
      remainingCarbsG: goalCarbs !== null ? goalCarbs - carbsConsumed : null,
      remainingFatG: goalFat !== null ? goalFat - fatConsumed : null,
      overProtein: goalProtein !== null ? proteinConsumed > goalProtein : null,
      overCarbs: goalCarbs !== null ? carbsConsumed > goalCarbs : null,
      overFat: goalFat !== null ? fatConsumed > goalFat : null,
    },
  };

  return toolResponse({
    meals: rows.map(row => ({
      mealId: row.mealId,
      date,
      mealType,
      description: row.description,
      calories: row.kcal,
      proteinG: row.protein ?? null,
      carbsG: row.carbs ?? null,
      fatG: row.fat ?? null,
    })),
    remaining,
  });
};

export const getMealsTool: ToolCallback<typeof GetMealsSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
  if (!userId) throw new Error('Authentication required');
  const limit = input.limit ?? DEFAULT_MEAL_LIMIT;
  const offset = input.offset ?? 0;

  const allRows = await getMeals(userId, omitNullish({ date: input.date, mealType: input.mealType }));

  // TODO: Implement count & pagination at query level to avoid fetching all rows into memory
  const totalCount = allRows.length;
  const page = allRows.slice(offset, offset + limit);
  const entries: MealEntry[] = page.map(rowToMealEntry);
  const hasMore = offset + limit < totalCount;

  return toolResponse({
    entries,
    totalCount,
    hasMore,
    nextOffset: hasMore ? offset + limit : null,
  });
};

export const deleteMealTool: ToolCallback<typeof DeleteMealSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
  if (!userId) throw new Error('Authentication required');
  const deleted = await deleteMeal(userId, input.mealId);
  if (!deleted) {
    throw new Error(`Meal with id "${input.mealId}" not found.`);
  }
  return toolResponse({ deleted: true, mealId: input.mealId });
};
