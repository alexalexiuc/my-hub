import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getCalorieProfile, upsertCalorieProfile } from "@my-hub/shared/services";
import { omitNullish } from "@my-hub/shared/utils";
import { ActivityLevel, Sex, ACTIVITY_MULTIPLIERS } from "../constants";
import type { BodyProfile } from "../types";
import type { CalorieProfile } from "@my-hub/shared/types";

export function calculateTDEE(profile: BodyProfile): {
  bmr: number | null;
  tdee: number | null;
  daily_calories: number | null;
} {
  const age = profile.age;
  const height = profile.height_cm;
  const weight = profile.weight_kg;
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
      height_cm: row.heightCm,
      weight_kg: row.weightKg,
      sex: row.sex,
      activity_level: row.activityLevel,
      goal_calories_override: row.goalCaloriesOverride,
      neck_cm: row.neckCm,
      waist_cm: row.waistCm,
      hips_cm: row.hipsCm,
      notes: row.notes,
    }),
  };
}

const UpdateProfileSchema = z.object({
  name: z.string().optional().describe("Your name"),
  age: z.number().int().positive().optional().describe("Age in years"),
  height_cm: z.number().positive().optional().describe("Height in centimeters"),
  weight_kg: z.number().positive().optional().describe("Weight in kilograms"),
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
    .describe("Manual daily calorie target override. If not set, calculated TDEE is used."),
  neck_cm: z.number().positive().optional().describe("Neck circumference in cm"),
  waist_cm: z.number().positive().optional().describe("Waist circumference in cm"),
  hips_cm: z
    .number()
    .positive()
    .optional()
    .describe("Hips circumference in cm (relevant for female body fat estimation)"),
  notes: z.string().optional().describe("Additional notes about your health goals"),
});

type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export function registerProfileTools(server: McpServer, userId: string) {
  server.registerTool(
    "calories_update_profile",
    {
      description:
        "Save or update body measurements and health profile. Used to compute your BMR (Basal Metabolic Rate) and TDEE (Total Daily Energy Expenditure) via the Mifflin-St Jeor equation. Only provided fields are updated — omitted fields retain their current values.",
      inputSchema: UpdateProfileSchema.shape,
      annotations: { idempotentHint: false, destructiveHint: false },
    },
    async (input: UpdateProfileInput) => {
      const row = await upsertCalorieProfile(
        userId,
        omitNullish({
          name: input.name,
          age: input.age,
          heightCm: input.height_cm,
          weightKg: input.weight_kg,
          sex: input.sex,
          activityLevel: input.activity_level,
          goalCaloriesOverride: input.goal_calories_override,
          neckCm: input.neck_cm,
          waistCm: input.waist_cm,
          hipsCm: input.hips_cm,
          notes: input.notes,
        }),
      );

      const profile = rowToProfile(row);
      const { bmr, tdee, daily_calories } = calculateTDEE(profile);

      return toolResponse({
        profile,
        calculated: { bmr, tdee, daily_calories },
      });
    },
  );

  server.registerTool(
    "calories_get_profile",
    {
      description: "Get the stored body profile including calculated BMR, TDEE, and daily calorie target.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const row = await getCalorieProfile(userId);
      const profile = row ? rowToProfile(row) : {};
      const { bmr, tdee, daily_calories } = calculateTDEE(profile);

      const activityDescriptions: Record<string, string> = {
        sedentary: "Desk job, little or no exercise",
        lightly_active: "Light exercise 1–3 days/week",
        moderately_active: "Moderate exercise 3–5 days/week",
        very_active: "Hard exercise 6–7 days/week",
        extra_active: "Very hard exercise or physical job",
      };

      return toolResponse({
        profile,
        calculated: {
          bmr,
          tdee,
          daily_calories,
          activity_description: profile.activity_level ? (activityDescriptions[profile.activity_level] ?? null) : null,
        },
      });
    },
  );
}

function toolResponse(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
  };
}
