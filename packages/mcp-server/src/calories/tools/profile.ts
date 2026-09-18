import { ToolHandler } from '../../shared/types';
import { HandledError } from '../../shared/errors';
import { upsertCalorieProfile, getLatestMeasurementsPerType } from '@my-hub/shared/services';
import { omitUndefined } from '@my-hub/shared/utils';
import { z } from 'zod';
import { toolResponse } from '../../shared/toolsUtils';
import { rowToProfile, profileToTargets } from '../models/profile';
import { ActivityLevels, GoalTypes, GymTimesValues, MeasurementTypes, Sexes } from '@my-hub/shared/constants';
import type { GymTime } from '@my-hub/shared/constants';

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
  goalStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe(
      'YYYY-MM-DD the current goal run started from. This is the fixed point progress is measured against, so a ' +
        'missed week carries forward instead of being forgiven — it is stamped automatically when the goal is set ' +
        'or its rate changes. Only pass it when the user explicitly wants to restart their goal from a given date, ' +
        'and pass goalStartWeightKg with it.',
    ),
  goalStartWeightKg: z
    .number()
    .positive()
    .optional()
    .describe('Weight in kg at goalStartDate. Pass together with goalStartDate when restarting a goal run.'),
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
  gymDayCalorieBonus: z
    .number()
    .nonnegative()
    .optional()
    .nullable()
    .describe(
      'Extra kcal added to the daily calorie target on gym days (defaults to 300). Pass null to reset to the default.',
    ),
  gymTime: z
    .enum(GymTimesValues as [GymTime, ...GymTime[]])
    .optional()
    .nullable()
    .describe(
      'When in the day the user trains: "morning" | "midday" | "evening". Decides which meals fall either side of ' +
        'the session, so pre_workout / post_workout meals can be placed correctly. A coarse band on purpose — do not ' +
        'ask for a clock time. Pass null to clear.',
    ),
  notes: z.string().optional().describe('Additional notes about your health goals'),
});

export const updateProfileTool: ToolHandler<typeof UpdateProfileSchema.shape> = async (input, context) => {
  const { userId } = context;

  // The anchor is a date and a weight together; half of one describes no point on the chart, and
  // would quietly drop the goal back to an inferred baseline.
  if ((input.goalStartDate === undefined) !== (input.goalStartWeightKg === undefined)) {
    throw new HandledError('goalStartDate and goalStartWeightKg must be set together.');
  }

  const updates: Record<string, unknown> = omitUndefined({
    age: input.age,
    sex: input.sex,
    heightCm: input.heightCm,
    activityLevel: input.activityLevel,
    goalType: input.goalType,
    goalWeeklyRateKg: input.goalWeeklyRateKg,
    goalStartDate: input.goalStartDate,
    goalStartWeightKg: input.goalStartWeightKg,
    notes: input.notes,
  });

  // Nullable fields: pass null explicitly to allow clearing stored values
  if (input.goalMinCalories !== undefined) updates.goalMinCalories = input.goalMinCalories;
  if (input.goalMaxCalories !== undefined) updates.goalMaxCalories = input.goalMaxCalories;
  if (input.goalProteinG !== undefined) updates.goalProtein = input.goalProteinG;
  if (input.goalCarbsG !== undefined) updates.goalCarbs = input.goalCarbsG;
  if (input.goalFatG !== undefined) updates.goalFat = input.goalFatG;
  if (input.gymDays !== undefined) updates.gymDays = input.gymDays ?? null;
  if (input.gymDayCalorieBonus !== undefined) updates.gymDayCalorieBonus = input.gymDayCalorieBonus;
  if (input.gymTime !== undefined) updates.gymTime = input.gymTime;

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
