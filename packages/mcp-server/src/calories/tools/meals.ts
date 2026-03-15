import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logMeal, getMeals, deleteMeal } from '@my-hub/shared/services';
import { omitNullish } from '@my-hub/shared/utils';
import { MealType, DEFAULT_MEAL_LIMIT, MAX_MEAL_LIMIT } from '../constants';
import type { MealEntry } from '../types';
import type { MealLog } from '@my-hub/shared/types';

const yyyyMmDdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');

const LogMealSchema = z.object({
  description: z
    .string()
    .describe(
      'What was eaten — describe the meal as seen in the photo or as told by the user, e.g. "grilled chicken breast with rice and salad"',
    ),
  calories: z
    .number()
    .int()
    .positive()
    .describe(
      'Estimated calorie content of the meal. If analyzing a photo, estimate based on visible portion sizes and typical nutritional values.',
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

const GetMealsSchema = z.object({
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

const DeleteMealSchema = z.object({
  meal_id: z.string().describe('The meal_id of the entry to delete'),
});

type LogMealInput = z.infer<typeof LogMealSchema>;
type GetMealsInput = z.infer<typeof GetMealsSchema>;
type DeleteMealInput = z.infer<typeof DeleteMealSchema>;

export function registerMealTools(server: McpServer) {
  server.registerTool(
    'calories_log_meal',
    {
      description:
        'Log a meal and its calorie content. Use this after analyzing a food photo or when the user describes what they ate. The model should estimate calories and optionally macros before calling this tool.',
      inputSchema: LogMealSchema.shape,
      annotations: { idempotentHint: false, destructiveHint: false },
    },
    async (input: LogMealInput, extra) => {
      const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
      if (!userId) throw new Error('Authentication required');
      const today = new Date().toISOString().split('T')[0]!;
      const date = input.date ?? today;
      const mealId = crypto.randomUUID();

      let meal_type = input.meal_type;
      if (!meal_type) {
        const hour = new Date().getUTCHours();
        if (hour < 10) meal_type = MealType.BREAKFAST;
        else if (hour < 14) meal_type = MealType.LUNCH;
        else if (hour < 19) meal_type = MealType.DINNER;
        else meal_type = MealType.SNACK;
      }

      const row = await logMeal({
        mealId,
        userId,
        date,
        mealType: meal_type,
        description: input.description,
        kcal: input.calories,
        protein: input.protein_g ?? null,
        carbs: input.carbs_g ?? null,
        fat: input.fat_g ?? null,
        notes: input.notes ?? null,
      });

      return toolResponse({
        meal_id: row.mealId,
        date,
        meal_type,
        description: input.description,
        calories: input.calories,
        protein_g: input.protein_g ?? null,
        carbs_g: input.carbs_g ?? null,
        fat_g: input.fat_g ?? null,
      });
    },
  );

  server.registerTool(
    'calories_get_meals',
    {
      description:
        'Retrieve logged meal entries. Filter by date or meal type. Useful for reviewing what was eaten on a given day.',
      inputSchema: GetMealsSchema.shape,
      annotations: { readOnlyHint: true },
    },
    async (input: GetMealsInput, extra) => {
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
    },
  );

  server.registerTool(
    'calories_delete_meal',
    {
      description: 'Delete a meal entry by its meal_id. Use this to correct a logging mistake.',
      inputSchema: DeleteMealSchema.shape,
      annotations: { idempotentHint: false, destructiveHint: true },
    },
    async (input: DeleteMealInput, extra) => {
      const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
      if (!userId) throw new Error('Authentication required');
      const deleted = await deleteMeal(userId, input.meal_id);
      if (!deleted) {
        throw new Error(`Meal with id "${input.meal_id}" not found.`);
      }
      return toolResponse({ deleted: true, meal_id: input.meal_id });
    },
  );
}

export function rowToMealEntry(row: MealLog): MealEntry {
  return {
    meal_id: row.mealId ?? '',
    date: row.date,
    meal_type: row.mealType,
    description: row.description,
    calories: row.kcal ?? 0,
    protein_g: row.protein,
    carbs_g: row.carbs,
    fat_g: row.fat,
    notes: row.notes,
    created_at: row.createdAt.toISOString(),
  };
}

function toolResponse(payload: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
  };
}
