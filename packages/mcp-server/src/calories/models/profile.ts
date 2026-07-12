import { omitNullish } from '@my-hub/shared/utils';
import type { BodyProfile } from '../types';
import type { CalorieProfile } from '@my-hub/shared/types';

export { profileToTargets } from '@my-hub/shared/utils';

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
