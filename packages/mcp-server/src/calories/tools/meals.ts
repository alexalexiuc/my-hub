import {
  getCalorieProfile,
  getMealsForDate,
  getLatestMeasurementsPerType,
  logMeal,
  getMeals,
  deleteMeal,
  findUserById,
} from '@my-hub/shared/services';
import z from 'zod';
import { MealType, MAX_MEAL_LIMIT, DEFAULT_MEAL_LIMIT } from '../constants';
import { rowToProfile, profileToTargets } from '../models/profile';
import { toolResponse } from '../../shared/toolsUtils';
import { yyyyMmDdSchema } from '../../shared/schemas';
import { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { omitNullish, localDateString, localHour } from '@my-hub/shared/utils';
import { rowToMealEntry } from '../models/meals';
import { MealEntry } from '../types';

export const MealItemSchema = z.object({
  name: z.string().describe('Name of the food item, e.g. "grilled chicken breast"'),
  calories: z.number().int().positive().describe('Estimated calories for this item'),
  protein_g: z.number().positive().optional().describe('Estimated protein in grams'),
  carbs_g: z.number().positive().optional().describe('Estimated carbs in grams'),
  fat_g: z.number().positive().optional().describe('Estimated fat in grams'),
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
  meal_type: z
    .nativeEnum(MealType)
    .optional()
    .describe(
      'Type of meal: "breakfast" | "lunch" | "dinner" | "snack". If not specified, infer from the time of day or context.',
    ),
  date: yyyyMmDdSchema.optional().describe('Date of the meal (YYYY-MM-DD). Defaults to today.'),
  protein_g: z.number().positive().optional().describe('Estimated protein content in grams'),
  carbs_g: z.number().positive().optional().describe('Estimated carbohydrate content in grams'),
  fat_g: z.number().positive().optional().describe('Estimated fat content in grams'),
  notes: z.string().optional().describe('Any additional notes, e.g. "restaurant portion, may be larger than typical"'),
});

export const GetMealsSchema = z.object({
  date: yyyyMmDdSchema.optional().describe('Filter to a specific date (YYYY-MM-DD). Omit for all entries.'),
  meal_type: z.nativeEnum(MealType).optional().describe('Filter by meal type'),
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
  meal_id: z.string().describe('The meal_id of the entry to delete'),
});

export const logMealTool: ToolCallback<typeof LogMealSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
  if (!userId) throw new Error('Authentication required');

  // Fetch user record first to resolve timezone for date/meal_type inference
  const [profileRow, userRecord] = await Promise.all([getCalorieProfile(userId), findUserById(userId)]);
  const timezone = userRecord?.timezone ?? null;

  const date = input.date ?? localDateString(timezone);

  let meal_type = input.meal_type;
  if (!meal_type) {
    const hour = localHour(timezone);
    if (hour < 10) meal_type = MealType.BREAKFAST;
    else if (hour < 14) meal_type = MealType.LUNCH;
    else if (hour < 19) meal_type = MealType.DINNER;
    else meal_type = MealType.SNACK;
  }

  // Determine items to log: individual items if provided, otherwise the whole meal as one entry
  const itemsToLog =
    input.items && input.items.length > 0
      ? input.items.map((item) => ({
          description: item.name,
          kcal: item.calories,
          protein: item.protein_g ?? null,
          carbs: item.carbs_g ?? null,
          fat: item.fat_g ?? null,
        }))
      : [
          {
            description: input.description,
            kcal: input.calories,
            protein: input.protein_g ?? null,
            carbs: input.carbs_g ?? null,
            fat: input.fat_g ?? null,
          },
        ];

  const rows = await Promise.all(
    itemsToLog.map((item) =>
      logMeal({
        mealId: crypto.randomUUID(),
        userId,
        date,
        mealType: meal_type,
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
  const weightM = latestMeasurements.find((m) => m.typeKey === 'weight');
  const targets = profileToTargets(profile, weightM?.value);
  const maxCal = targets.maxCalories;
  const caloriesConsumed = dayRows.reduce((s, r) => s + (r.kcal ?? 0), 0);
  const remainingCalories = maxCal !== null ? maxCal - caloriesConsumed : null;

  const remaining = {
    calories_consumed: caloriesConsumed,
    goal_calories: targets.goalCalories,
    min_calories: targets.minCalories,
    max_calories: maxCal,
    remaining_calories: remainingCalories,
    over_budget: remainingCalories !== null ? remainingCalories < 0 : null,
  };

  return toolResponse({
    meals: rows.map((row) => ({
      meal_id: row.mealId,
      date,
      meal_type,
      description: row.description,
      calories: row.kcal,
      protein_g: row.protein ?? null,
      carbs_g: row.carbs ?? null,
      fat_g: row.fat ?? null,
    })),
    remaining,
  });
};

export const getMealsTool: ToolCallback<typeof GetMealsSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
  if (!userId) throw new Error('Authentication required');
  const limit = input.limit ?? DEFAULT_MEAL_LIMIT;
  const offset = input.offset ?? 0;

  const allRows = await getMeals(userId, omitNullish({ date: input.date, mealType: input.meal_type }));

  // TODO: Implement count & pagination at query level to avoid fetching all rows into memory
  const total_count = allRows.length;
  const page = allRows.slice(offset, offset + limit);
  const entries: MealEntry[] = page.map(rowToMealEntry);
  const has_more = offset + limit < total_count;

  return toolResponse({
    entries,
    total_count,
    has_more,
    next_offset: has_more ? offset + limit : null,
  });
};

export const deleteMealTool: ToolCallback<typeof DeleteMealSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
  if (!userId) throw new Error('Authentication required');
  const deleted = await deleteMeal(userId, input.meal_id);
  if (!deleted) {
    throw new Error(`Meal with id "${input.meal_id}" not found.`);
  }
  return toolResponse({ deleted: true, meal_id: input.meal_id });
};
