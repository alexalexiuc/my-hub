import { omitNullish, calculateCalorieTargets } from '@my-hub/shared/utils';
import type { CalorieTargets } from '@my-hub/shared/utils';
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
