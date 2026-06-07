import { omitNullish, calculateCalorieTargets } from '@my-hub/shared/utils';
import type { CalorieTargets } from '@my-hub/shared/utils';
import type { BodyProfile } from '../types';
import type { CalorieProfile } from '@my-hub/shared/types';

export function rowToProfile(row: CalorieProfile): BodyProfile {
  return {
    updatedAt: row.updatedAt.toISOString(),
    ...omitNullish({
      age: row.age,
      sex: row.sex,
      heightCm: row.heightCm,
      activityLevel: row.activityLevel,
      goalType: row.goalType,
      goalWeeklyRateKg: row.goalWeeklyRateKg,
      goalMinCalories: row.goalMinCalories,
      goalMaxCalories: row.goalMaxCalories,
      gymDays: row.gymDays ?? undefined,
      notes: row.notes,
    }),
  };
}

export function profileToTargets(profile: BodyProfile, weightKg?: number | null): CalorieTargets {
  return calculateCalorieTargets({
    age: profile.age ?? null,
    sex: profile.sex ?? null,
    heightCm: profile.heightCm ?? null,
    weightKg: weightKg ?? null,
    activityLevel: profile.activityLevel ?? null,
    goalType: profile.goalType ?? null,
    goalWeeklyRateKg: profile.goalWeeklyRateKg ?? null,
    goalMinCalories: profile.goalMinCalories ?? null,
    goalMaxCalories: profile.goalMaxCalories ?? null,
  });
}
