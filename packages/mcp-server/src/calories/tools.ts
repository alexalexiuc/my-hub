import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  logMeal,
  getMeals,
  deleteMeal,
  getCalorieProfile,
  getMealsForDate,
  getLatestMeasurementsPerType,
  upsertCalorieProfile,
  getMeasurementTypes,
  getMeasurementTypeByKey,
  logMeasurement,
  getMeasurements,
  deleteMeasurement,
} from '@my-hub/shared/services';
import { omitNullish } from '@my-hub/shared/utils';
import { ActivityLevel, GoalType, MealType, Sex, DEFAULT_MEAL_LIMIT, MAX_MEAL_LIMIT } from './constants';
import type { MealEntry } from './types';
import type { MeasurementTypeKey } from '@my-hub/shared/types';
import { rowToProfile, profileToTargets } from './models/profile';
import { rowToMealEntry } from './models/meals';
import { rowToMeasurementEntry } from './models/measurements';
import { sumMeals } from './models/summary';

const yyyyMmDdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');

// ---------------------------------------------------------------------------
// Meal tool schemas
// ---------------------------------------------------------------------------

const MealItemSchema = z.object({
  name: z.string().describe('Name of the food item, e.g. "grilled chicken breast"'),
  calories: z.number().int().positive().describe('Estimated calories for this item'),
  protein_g: z.number().positive().optional().describe('Estimated protein in grams'),
  carbs_g: z.number().positive().optional().describe('Estimated carbs in grams'),
  fat_g: z.number().positive().optional().describe('Estimated fat in grams'),
});

const LogMealSchema = z.object({
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

// ---------------------------------------------------------------------------
// Profile tool schemas
// ---------------------------------------------------------------------------

const UpdateProfileSchema = z.object({
  name: z.string().optional().describe('Your name'),
  age: z.number().int().positive().optional().describe('Age in years'),
  sex: z.nativeEnum(Sex).optional().describe('Biological sex for BMR calculation: "male" | "female"'),
  height_cm: z
    .number()
    .positive()
    .optional()
    .describe('Height in centimetres (e.g. 175). Stored on profile — only needs to be set once.'),
  activity_level: z
    .nativeEnum(ActivityLevel)
    .optional()
    .describe(
      'Activity level for TDEE: "sedentary" | "lightly_active" | "moderately_active" | "very_active" | "extra_active"',
    ),
  goal_type: z
    .nativeEnum(GoalType)
    .optional()
    .describe(
      'Calorie goal: "weight_loss" | "weight_gain" | "maintain". Ask the user which goal they want before saving.',
    ),
  goal_weekly_rate_kg: z
    .number()
    .positive()
    .max(2)
    .optional()
    .describe(
      'Weekly loss or gain rate in kg (e.g. 0.5 for half a kg/week). Required when goal_type is weight_loss or weight_gain.',
    ),
  goal_min_calories: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Override: explicit minimum daily calories floor (optional).'),
  goal_max_calories: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Override: explicit maximum daily calories ceiling (optional). Overrides the TDEE-derived target.'),
  notes: z.string().optional().describe('Additional notes about your health goals'),
});

// ---------------------------------------------------------------------------
// Summary tool schemas
// ---------------------------------------------------------------------------

const GetDailySummarySchema = z.object({
  date: yyyyMmDdSchema.optional().describe('Date to summarize (YYYY-MM-DD). Defaults to today.'),
});

// ---------------------------------------------------------------------------
// Measurement tool schemas
// ---------------------------------------------------------------------------

const LogMeasurementSchema = z.object({
  type: z
    .string()
    .describe(
      'Measurement type key, e.g. "weight", "height", "waist". Use calories_get_measurement_types to list available types.',
    ),
  value: z.number().positive().describe("Measurement value in the type's unit (e.g. kg for weight, cm for height)"),
  date: yyyyMmDdSchema.optional().describe('Date of measurement (YYYY-MM-DD). Defaults to today.'),
  notes: z.string().optional().describe('Optional notes about this measurement'),
});

const GetMeasurementsSchema = z.object({
  type: z.string().optional().describe('Filter by measurement type key (e.g. "weight")'),
  date_from: yyyyMmDdSchema.optional().describe('Start date filter (YYYY-MM-DD)'),
  date_to: yyyyMmDdSchema.optional().describe('End date filter (YYYY-MM-DD)'),
  limit: z.number().int().positive().max(500).default(100).optional().describe('Max entries to return (default: 100)'),
});

const DeleteMeasurementSchema = z.object({
  id: z.number().int().positive().describe('The measurement entry ID to delete'),
});

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

type LogMealInput = z.infer<typeof LogMealSchema>;
type GetMealsInput = z.infer<typeof GetMealsSchema>;
type DeleteMealInput = z.infer<typeof DeleteMealSchema>;
type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
type GetDailySummaryInput = z.infer<typeof GetDailySummarySchema>;
type LogMeasurementInput = z.infer<typeof LogMeasurementSchema>;
type GetMeasurementsInput = z.infer<typeof GetMeasurementsSchema>;
type DeleteMeasurementInput = z.infer<typeof DeleteMeasurementSchema>;

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerCaloriesTools(server: McpServer): void {
  // ---- Meal tools ----

  server.registerTool(
    'calories_log_meal',
    {
      description:
        'Log a meal and its calorie content. Use this after analyzing a food photo or when the user describes what they ate. The model should estimate calories and optionally macros before calling this tool. If the meal consists of multiple distinct foods (e.g. burger + fries), use the items array to log them all in a single call instead of calling this tool multiple times.',
      inputSchema: LogMealSchema.shape,
      annotations: { idempotentHint: false, destructiveHint: false },
    },
    async (input: LogMealInput, extra) => {
      const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
      if (!userId) throw new Error('Authentication required');
      const today = new Date().toISOString().split('T')[0]!;
      const date = input.date ?? today;

      let meal_type = input.meal_type;
      if (!meal_type) {
        const hour = new Date().getUTCHours();
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
      const [profileRow, dayRows, latestMeasurements] = await Promise.all([
        getCalorieProfile(userId),
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

  // ---- Profile tools ----

  server.registerTool(
    'calories_update_profile',
    {
      description:
        'Save or update health profile (age, sex, height, activity level, and goal). ' +
        'Computes BMR and TDEE via the Mifflin-St Jeor equation. ' +
        'IMPORTANT: Always ask the user what their goal is (weight_loss, weight_gain, or maintain) before calling this tool. ' +
        'For weight_loss or weight_gain, also ask for the weekly rate in kg. ' +
        'Height (height_cm) is stored on the profile and only needs to be set once. ' +
        'Weight and other changing body measurements are logged separately via calories_log_measurement.',
      inputSchema: UpdateProfileSchema.shape,
      annotations: { idempotentHint: false, destructiveHint: false },
    },
    async (input: UpdateProfileInput, extra) => {
      const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
      if (!userId) throw new Error('Authentication required');

      const row = await upsertCalorieProfile(
        userId,
        omitNullish({
          name: input.name,
          age: input.age,
          sex: input.sex,
          heightCm: input.height_cm,
          activityLevel: input.activity_level,
          goalType: input.goal_type,
          goalWeeklyRateKg: input.goal_weekly_rate_kg,
          goalMinCalories: input.goal_min_calories,
          goalMaxCalories: input.goal_max_calories,
          notes: input.notes,
        }),
      );

      const profile = rowToProfile(row);
      const latestMeasurements = await getLatestMeasurementsPerType(userId);
      const weightMeasurement = latestMeasurements.find((m) => m.typeKey === 'weight');
      const targets = profileToTargets(profile, weightMeasurement?.value);

      return toolResponse({
        profile,
        calculated: {
          tdee: targets.tdee,
          goal_calories: targets.goalCalories,
          min_calories: targets.minCalories,
          max_calories: targets.maxCalories,
        },
      });
    },
  );

  // ---- Summary tools ----

  server.registerTool(
    'calories_get_daily_summary',
    {
      description:
        'Get a full calorie and macro summary for a given day, broken down by meal. Also shows progress against the daily target. For today use the calories://today resource instead.',
      inputSchema: GetDailySummarySchema.shape,
      annotations: { readOnlyHint: true },
    },
    async (input: GetDailySummaryInput, extra) => {
      const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
      if (!userId) throw new Error('Authentication required');
      const today = new Date().toISOString().split('T')[0]!;
      const date = input.date ?? today;

      const [profileRow, dayRows, latestMeasurements] = await Promise.all([
        getCalorieProfile(userId),
        getMealsForDate(userId, date),
        getLatestMeasurementsPerType(userId),
      ]);

      const profile = profileRow ? rowToProfile(profileRow) : {};
      const weightM = latestMeasurements.find((m) => m.typeKey === 'weight');
      const targets = profileToTargets(profile, weightM?.value);
      const meals = dayRows.map(rowToMealEntry);
      const totals = sumMeals(meals);
      const goalCal = targets.goalCalories;
      const maxCal = targets.maxCalories;
      const remaining = maxCal !== null ? maxCal - totals.calories : null;

      // goal_met: for weight_loss stay under max; for weight_gain hit the goal; otherwise hit goal
      const goalType = 'goal_type' in profile ? profile.goal_type : null;
      let goalMet: boolean | null = null;
      if (maxCal !== null) {
        goalMet = goalType === 'weight_gain' ? totals.calories >= (goalCal ?? maxCal) : totals.calories <= maxCal;
      }

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
        goal_calories: goalCal,
        min_calories: targets.minCalories,
        max_calories: maxCal,
        remaining_calories: remaining,
        goal_met: goalMet,
      });
    },
  );

  // ---- Measurement tools ----

  server.registerTool(
    'calories_log_measurement',
    {
      description:
        'Log a body measurement (weight, height, waist, etc.). Each entry is timestamped so you can track progress over time. Use calories_get_measurement_types to see available types.',
      inputSchema: LogMeasurementSchema.shape,
      annotations: { idempotentHint: false, destructiveHint: false },
    },
    async (input: LogMeasurementInput, extra) => {
      const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
      if (!userId) throw new Error('Authentication required');

      const measurementType = await getMeasurementTypeByKey(input.type as MeasurementTypeKey);
      if (!measurementType) {
        const types = await getMeasurementTypes();
        throw new Error(
          `Unknown measurement type "${input.type}". Available types: ${types.map((t) => t.key).join(', ')}`,
        );
      }

      const today = new Date().toISOString().split('T')[0]!;
      const row = await logMeasurement({
        userId,
        typeKey: measurementType.key,
        date: input.date ?? today,
        value: input.value,
        notes: input.notes ?? null,
      });

      return toolResponse({
        id: row.id,
        type: measurementType.key,
        label: measurementType.label,
        value: row.value,
        unit: measurementType.unit,
        date: row.date,
      });
    },
  );

  server.registerTool(
    'calories_get_measurements',
    {
      description:
        'Retrieve logged body measurements. Filter by type, date range, or get all. Useful for tracking progress.',
      inputSchema: GetMeasurementsSchema.shape,
      annotations: { readOnlyHint: true },
    },
    async (input: GetMeasurementsInput, extra) => {
      const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
      if (!userId) throw new Error('Authentication required');

      let typeKey: MeasurementTypeKey | undefined;
      if (input.type) {
        const mt = await getMeasurementTypeByKey(input.type as MeasurementTypeKey);
        if (!mt) throw new Error(`Unknown measurement type "${input.type}"`);
        typeKey = mt.key;
      }

      const rows = await getMeasurements(userId, {
        typeKey,
        dateFrom: input.date_from,
        dateTo: input.date_to,
        limit: input.limit ?? 100,
      });

      return toolResponse({
        entries: rows.map(rowToMeasurementEntry),
        count: rows.length,
      });
    },
  );

  server.registerTool(
    'calories_get_measurement_types',
    {
      description: 'List all available measurement types with their units (weight in kg, height in cm, etc.)',
      annotations: { readOnlyHint: true },
    },
    async () => {
      const types = await getMeasurementTypes();
      return toolResponse(types.map((t) => ({ key: t.key, label: t.label, unit: t.unit })));
    },
  );

  server.registerTool(
    'calories_delete_measurement',
    {
      description: 'Delete a measurement entry by its ID.',
      inputSchema: DeleteMeasurementSchema.shape,
      annotations: { idempotentHint: false, destructiveHint: true },
    },
    async (input: DeleteMeasurementInput, extra) => {
      const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
      if (!userId) throw new Error('Authentication required');
      const deleted = await deleteMeasurement(input.id, userId);
      if (!deleted) {
        throw new Error(`Measurement with id ${input.id} not found.`);
      }
      return toolResponse({ deleted: true, id: input.id });
    },
  );
}

function toolResponse(payload: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
  };
}
