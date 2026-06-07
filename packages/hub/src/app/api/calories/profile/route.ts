import { z } from 'zod';
import { route } from '@/lib/api/route';
import { getCalorieProfile, upsertCalorieProfile, getLatestMeasurementsPerType } from '@my-hub/shared/services';
import { ActivityLevelsValues, GoalTypesValues, SexesValues } from '@my-hub/shared/constants';

const ProfileUpdateSchema = z.object({
  age: z.number().int().positive().optional(),
  sex: z.enum(SexesValues as [string, ...string[]]).optional(),
  heightCm: z.number().positive().optional(),
  activityLevel: z.enum(ActivityLevelsValues as [string, ...string[]]).optional(),
  goalType: z.enum(GoalTypesValues as [string, ...string[]]).optional(),
  goalWeeklyRateKg: z.number().optional(),
  goalMinCalories: z.number().int().nonnegative().nullable().optional(),
  goalMaxCalories: z.number().int().nonnegative().nullable().optional(),
  goalProtein: z.number().nonnegative().nullable().optional(),
  goalCarbs: z.number().nonnegative().nullable().optional(),
  goalFat: z.number().nonnegative().nullable().optional(),
  gymDays: z.array(z.number().int().min(0).max(6)).nullable().optional(),
  notes: z.string().optional(),
});

export const GET = route(async ({ user }) => {
  const [profile, measurements] = await Promise.all([
    getCalorieProfile(user.id),
    getLatestMeasurementsPerType(user.id),
  ]);
  return { profile: profile ?? null, measurements };
});

export const PUT = route({ body: ProfileUpdateSchema })(async ({ user, body }) => {
  const updates: Record<string, unknown> = { ...body };

  for (const key of ['goalMinCalories', 'goalMaxCalories'] as const) {
    if (typeof updates[key] === 'number') updates[key] = Math.round(updates[key] as number);
  }

  const profile = await upsertCalorieProfile(user.id, updates);
  return { profile };
});
