import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getCalorieProfile, upsertCalorieProfile, getLatestMeasurementsPerType } from '@my-hub/shared/services';
import { omitNullish, calculateCalorieTargets } from '@my-hub/shared/utils';
import type { CalorieTargets } from '@my-hub/shared/utils';
import { ActivityLevel, Sex, GoalType } from '../constants';
import type { BodyProfile } from '../types';
import type { CalorieProfile } from '@my-hub/shared/types';

export function rowToProfile(row: CalorieProfile): BodyProfile {
  return {
    updated_at: row.updatedAt.toISOString(),
    ...omitNullish({
      name: row.name,
      age: row.age,
      sex: row.sex,
      height_cm: row.heightCm,
      activity_level: row.activityLevel,
      goal_type: row.goalType,
      goal_weekly_rate_kg: row.goalWeeklyRateKg,
      goal_min_calories: row.goalMinCalories,
      goal_max_calories: row.goalMaxCalories,
      notes: row.notes,
    }),
  };
}

export function profileToTargets(profile: BodyProfile, weightKg?: number | null): CalorieTargets {
  return calculateCalorieTargets({
    age: profile.age ?? null,
    sex: profile.sex ?? null,
    heightCm: profile.height_cm ?? null,
    weightKg: weightKg ?? null,
    activityLevel: profile.activity_level ?? null,
    goalType: profile.goal_type ?? null,
    goalWeeklyRateKg: profile.goal_weekly_rate_kg ?? null,
    goalMinCalories: profile.goal_min_calories ?? null,
    goalMaxCalories: profile.goal_max_calories ?? null,
  });
}

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

type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export function registerProfileTools(server: McpServer) {
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

  server.registerTool(
    'calories_get_profile',
    {
      description:
        'Get the stored health profile including calculated BMR, TDEE, goal calorie targets, and latest measurements.',
      annotations: { readOnlyHint: true },
    },
    async (extra) => {
      const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
      if (!userId) throw new Error('Authentication required');

      const row = await getCalorieProfile(userId);
      const profile = row ? rowToProfile(row) : {};
      const latestMeasurements = await getLatestMeasurementsPerType(userId);
      const weightMeasurement = latestMeasurements.find((m) => m.typeKey === 'weight');
      const targets = profileToTargets(profile, weightMeasurement?.value);

      const activityDescriptions: Record<string, string> = {
        sedentary: 'Desk job, little or no exercise',
        lightly_active: 'Light exercise 1–3 days/week',
        moderately_active: 'Moderate exercise 3–5 days/week',
        very_active: 'Hard exercise 6–7 days/week',
        extra_active: 'Very hard exercise or physical job',
      };

      const goalDescriptions: Record<string, string> = {
        weight_loss: 'Lose weight',
        weight_gain: 'Gain weight',
        maintain: 'Maintain weight',
      };

      return toolResponse({
        profile,
        calculated: {
          tdee: targets.tdee,
          goal_calories: targets.goalCalories,
          min_calories: targets.minCalories,
          max_calories: targets.maxCalories,
          activity_description:
            'activity_level' in profile && profile.activity_level
              ? (activityDescriptions[profile.activity_level as string] ?? null)
              : null,
          goal_description:
            'goal_type' in profile && profile.goal_type
              ? (goalDescriptions[profile.goal_type as string] ?? null)
              : null,
        },
        latest_measurements: latestMeasurements.map((m) => ({
          type: m.typeKey,
          label: m.typeLabel,
          value: m.value,
          unit: m.typeUnit,
          date: m.date,
        })),
      });
    },
  );
}

function toolResponse(payload: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
  };
}
