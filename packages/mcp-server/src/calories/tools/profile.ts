import { ToolHandler } from '../../shared/types';
import { upsertCalorieProfile, getLatestMeasurementsPerType } from '@my-hub/shared/services';
import { omitUndefined } from '@my-hub/shared/utils';
import { z } from 'zod';
import { toolResponse } from '../../shared/toolsUtils';
import { rowToProfile, profileToTargets } from '../models/profile';
import { ActivityLevels, GoalTypes, MeasurementTypes, Sexes } from '@my-hub/shared/constants';

export const UpdateProfileSchema = z.object({
  age: z.number().int().positive().optional().describe('Age in years'),
  sex: z.enum(Sexes).optional().describe('Biological sex for BMR calculation: "male" | "female"'),
  heightCm: z
    .number()
    .positive()
    .optional()
    .describe('Height in centimeters (e.g. 175). Stored on profile — only needs to be set once.'),
  activityLevel: z
    .enum(ActivityLevels)
    .optional()
    .describe(
      'Activity level for TDEE: "sedentary" | "lightly_active" | "moderately_active" | "very_active" | "extra_active"',
    ),
  goalType: z
    .enum(GoalTypes)
    .optional()
    .describe(
      'Calorie goal: "weight_loss" | "weight_gain" | "maintain". Ask the user which goal they want before saving.',
    ),
  goalWeeklyRateKg: z
    .number()
    .positive()
    .max(2)
    .optional()
    .describe(
      'Weekly loss or gain rate in kg (e.g. 0.5 for half a kg/week). Required when goalType is weight_loss or weight_gain.',
    ),
  goalMinCalories: z
    .number()
    .int()
    .positive()
    .optional()
    .nullable()
    .describe('Override: explicit minimum daily calories floor (optional). Pass null to clear.'),
  goalMaxCalories: z
    .number()
    .int()
    .positive()
    .optional()
    .nullable()
    .describe(
      'Override: explicit maximum daily calories ceiling (optional). Overrides the TDEE-derived target. Required as a reference when setting macros by percentage. Pass null to clear.',
    ),
  goalProteinG: z
    .number()
    .int()
    .positive()
    .optional()
    .nullable()
    .describe('Daily protein target in grams (e.g. 150). Pass null to clear.'),
  goalCarbsG: z
    .number()
    .int()
    .positive()
    .optional()
    .nullable()
    .describe('Daily carbohydrate target in grams (e.g. 250). Pass null to clear.'),
  goalFatG: z
    .number()
    .int()
    .positive()
    .optional()
    .nullable()
    .describe('Daily fat target in grams (e.g. 80). Pass null to clear.'),
  gymDays: z
    .array(z.number().int().min(0).max(6))
    .optional()
    .nullable()
    .describe(
      'Days of the week the user goes to the gym: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday. Pass an empty array or null to clear.',
    ),
  notes: z.string().optional().describe('Additional notes about your health goals'),
});

export const updateProfileTool: ToolHandler<typeof UpdateProfileSchema.shape> = async (input, context) => {
  const { userId } = context;

  const updates: Record<string, unknown> = omitUndefined({
    age: input.age,
    sex: input.sex,
    heightCm: input.heightCm,
    activityLevel: input.activityLevel,
    goalType: input.goalType,
    goalWeeklyRateKg: input.goalWeeklyRateKg,
    notes: input.notes,
  });

  // Nullable fields: pass null explicitly to allow clearing stored values
  if (input.goalMinCalories !== undefined) updates.goalMinCalories = input.goalMinCalories;
  if (input.goalMaxCalories !== undefined) updates.goalMaxCalories = input.goalMaxCalories;
  if (input.goalProteinG !== undefined) updates.goalProtein = input.goalProteinG;
  if (input.goalCarbsG !== undefined) updates.goalCarbs = input.goalCarbsG;
  if (input.goalFatG !== undefined) updates.goalFat = input.goalFatG;
  if (input.gymDays !== undefined) updates.gymDays = input.gymDays ?? null;

  const row = await upsertCalorieProfile(userId, updates);

  const profile = rowToProfile(row);
  const latestMeasurements = await getLatestMeasurementsPerType(userId);
  const weightMeasurement = latestMeasurements.find(m => m.typeKey === MeasurementTypes.Weight);
  const targets = profileToTargets(profile, weightMeasurement?.value);

  return toolResponse({
    profile,
    calculated: {
      tdee: targets.tdee,
      goalCalories: targets.goalCalories,
      minCalories: targets.minCalories,
      maxCalories: targets.maxCalories,
    },
  });
};
