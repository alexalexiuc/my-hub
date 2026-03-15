import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getCalorieProfile, upsertCalorieProfile, getLatestMeasurementsPerType } from '@my-hub/shared/services';
import { omitNullish } from '@my-hub/shared/utils';
import { ActivityLevel, Sex, ACTIVITY_MULTIPLIERS } from '../constants';
import type { BodyProfile } from '../types';
import type { CalorieProfile } from '@my-hub/shared/types';

export function calculateTDEE(
  profile: BodyProfile,
  heightCm?: number | null,
  weightKg?: number | null,
): {
  bmr: number | null;
  tdee: number | null;
  daily_calories: number | null;
} {
  const age = profile.age;
  const height = heightCm ?? null;
  const weight = weightKg ?? null;
  const sex = profile.sex as Sex;
  const activity = profile.activity_level as ActivityLevel;

  if (!age || !height || !weight || (sex !== Sex.MALE && sex !== Sex.FEMALE)) {
    return { bmr: null, tdee: null, daily_calories: null };
  }

  // Mifflin-St Jeor equation
  let bmr: number;
  if (sex === Sex.MALE) {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }

  const multiplier = ACTIVITY_MULTIPLIERS[activity] ?? ACTIVITY_MULTIPLIERS[ActivityLevel.SEDENTARY];
  const tdee = Math.round(bmr * multiplier);
  bmr = Math.round(bmr);

  const override = profile.goal_calories_override;
  const daily_calories = override && override > 0 ? override : tdee;

  return { bmr, tdee, daily_calories };
}

export function rowToProfile(row: CalorieProfile): BodyProfile {
  return {
    updated_at: row.updatedAt.toISOString(),
    ...omitNullish({
      name: row.name,
      age: row.age,
      sex: row.sex,
      activity_level: row.activityLevel,
      goal_calories_override: row.goalCaloriesOverride,
      notes: row.notes,
    }),
  };
}

const UpdateProfileSchema = z.object({
  name: z.string().optional().describe('Your name'),
  age: z.number().int().positive().optional().describe('Age in years'),
  sex: z.nativeEnum(Sex).optional().describe('Biological sex for BMR calculation: "male" | "female"'),
  activity_level: z
    .nativeEnum(ActivityLevel)
    .optional()
    .describe(
      'Activity level for TDEE: "sedentary" | "lightly_active" | "moderately_active" | "very_active" | "extra_active"',
    ),
  goal_calories_override: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Manual daily calorie target override. If not set, calculated TDEE is used.'),
  notes: z.string().optional().describe('Additional notes about your health goals'),
});

type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export function registerProfileTools(server: McpServer) {
  server.registerTool(
    'calories_update_profile',
    {
      description:
        'Save or update health profile (age, sex, activity level). Used to compute your BMR and TDEE via the Mifflin-St Jeor equation. Body measurements (height, weight, etc.) are logged separately via calories_log_measurement.',
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
          activityLevel: input.activity_level,
          goalCaloriesOverride: input.goal_calories_override,
          notes: input.notes,
        }),
      );

      const profile = rowToProfile(row);
      const latestMeasurements = await getLatestMeasurementsPerType(userId);
      const heightMeasurement = latestMeasurements.find((m) => m.typeKey === 'height');
      const weightMeasurement = latestMeasurements.find((m) => m.typeKey === 'weight');
      const { bmr, tdee, daily_calories } = calculateTDEE(
        profile,
        heightMeasurement?.value,
        weightMeasurement?.value,
      );

      return toolResponse({
        profile,
        calculated: { bmr, tdee, daily_calories },
      });
    },
  );

  server.registerTool(
    'calories_get_profile',
    {
      description:
        'Get the stored health profile including calculated BMR, TDEE, and daily calorie target. Height and weight are sourced from the latest body measurements.',
      annotations: { readOnlyHint: true },
    },
    async (extra) => {
      const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
      if (!userId) throw new Error('Authentication required');
      const row = await getCalorieProfile(userId);
      const profile = row ? rowToProfile(row) : {};
      const latestMeasurements = await getLatestMeasurementsPerType(userId);
      const heightMeasurement = latestMeasurements.find((m) => m.typeKey === 'height');
      const weightMeasurement = latestMeasurements.find((m) => m.typeKey === 'weight');
      const { bmr, tdee, daily_calories } = calculateTDEE(
        profile,
        heightMeasurement?.value,
        weightMeasurement?.value,
      );

      const activityDescriptions: Record<string, string> = {
        sedentary: 'Desk job, little or no exercise',
        lightly_active: 'Light exercise 1–3 days/week',
        moderately_active: 'Moderate exercise 3–5 days/week',
        very_active: 'Hard exercise 6–7 days/week',
        extra_active: 'Very hard exercise or physical job',
      };

      return toolResponse({
        profile,
        calculated: {
          bmr,
          tdee,
          daily_calories,
          activity_description:
            'activity_level' in profile && profile.activity_level
              ? (activityDescriptions[profile.activity_level as string] ?? null)
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
