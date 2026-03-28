import { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { upsertCalorieProfile, getLatestMeasurementsPerType } from '@my-hub/shared/services';
import { omitNullish } from '@my-hub/shared/utils';
import z from 'zod';
import { toolResponse } from '../../shared/toolsUtils';
import { Sex, ActivityLevel, GoalType } from '../constants';
import { rowToProfile, profileToTargets } from '../models/profile';

export const UpdateProfileSchema = z.object({
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
  country: z
    .string()
    .regex(/^[A-Z]{2}$/, 'Must be a 2-letter uppercase ISO 3166-1 alpha-2 code')
    .optional()
    .describe('ISO 3166-1 alpha-2 country code (e.g. "US", "GB"). Used as fallback timezone context.'),
  timezone: z
    .string()
    .optional()
    .describe(
      'IANA timezone identifier (e.g. "America/New_York", "Europe/Bucharest"). Used to determine local date when logging meals without an explicit date.',
    ),
});

export const updateProfileTool: ToolCallback<typeof UpdateProfileSchema.shape> = async (input, extra) => {
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
      country: input.country,
      timezone: input.timezone,
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
};
