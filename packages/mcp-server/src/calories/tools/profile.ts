import { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { upsertCalorieProfile, getLatestMeasurementsPerType } from '@my-hub/shared/services';
import { omitNullish } from '@my-hub/shared/utils';
import z from 'zod';
import { toolResponse } from '../../shared/toolsUtils';
import { rowToProfile, profileToTargets } from '../models/profile';
import { ActivityLevels, GoalTypes, MeasurementTypes, Sexes } from '@my-hub/shared/constants';

export const UpdateProfileSchema = z.object({
  name: z.string().optional().describe('Your name'),
  age: z.number().int().positive().optional().describe('Age in years'),
  sex: z.nativeEnum(Sexes).optional().describe('Biological sex for BMR calculation: "male" | "female"'),
  height_cm: z
    .number()
    .positive()
    .optional()
    .describe('Height in centimetres (e.g. 175). Stored on profile — only needs to be set once.'),
  activity_level: z
    .nativeEnum(ActivityLevels)
    .optional()
    .describe(
      'Activity level for TDEE: "sedentary" | "lightly_active" | "moderately_active" | "very_active" | "extra_active"',
    ),
  goal_type: z
    .nativeEnum(GoalTypes)
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
    .nullable()
    .describe('Override: explicit minimum daily calories floor (optional). Pass null to clear.'),
  goal_max_calories: z
    .number()
    .int()
    .positive()
    .optional()
    .nullable()
    .describe(
      'Override: explicit maximum daily calories ceiling (optional). Overrides the TDEE-derived target. Required as a reference when setting macros by percentage. Pass null to clear.',
    ),
  goal_protein_g: z
    .number()
    .int()
    .positive()
    .optional()
    .nullable()
    .describe('Daily protein target in grams (e.g. 150). Pass null to clear.'),
  goal_carbs_g: z
    .number()
    .int()
    .positive()
    .optional()
    .nullable()
    .describe('Daily carbohydrate target in grams (e.g. 250). Pass null to clear.'),
  goal_fat_g: z
    .number()
    .int()
    .positive()
    .optional()
    .nullable()
    .describe('Daily fat target in grams (e.g. 80). Pass null to clear.'),
  notes: z.string().optional().describe('Additional notes about your health goals'),
});

export const updateProfileTool: ToolCallback<typeof UpdateProfileSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
  if (!userId) throw new Error('Authentication required');

  const updates: Record<string, unknown> = omitNullish({
    name: input.name,
    age: input.age,
    sex: input.sex,
    heightCm: input.height_cm,
    activityLevel: input.activity_level,
    goalType: input.goal_type,
    goalWeeklyRateKg: input.goal_weekly_rate_kg,
    notes: input.notes,
  });

  // Nullable fields: pass null explicitly to allow clearing stored values
  if (input.goal_min_calories !== undefined) updates['goalMinCalories'] = input.goal_min_calories;
  if (input.goal_max_calories !== undefined) updates['goalMaxCalories'] = input.goal_max_calories;
  if (input.goal_protein_g !== undefined) updates['goalProtein'] = input.goal_protein_g;
  if (input.goal_carbs_g !== undefined) updates['goalCarbs'] = input.goal_carbs_g;
  if (input.goal_fat_g !== undefined) updates['goalFat'] = input.goal_fat_g;

  const row = await upsertCalorieProfile(userId, updates);

  const profile = rowToProfile(row);
  const latestMeasurements = await getLatestMeasurementsPerType(userId);
  const weightMeasurement = latestMeasurements.find((m) => m.typeKey === MeasurementTypes.Weight);
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
};
