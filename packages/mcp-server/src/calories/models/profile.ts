import { omitNullish } from '@my-hub/shared/utils';
import { DEFAULT_GYM_DAY_CALORIE_BONUS } from '@my-hub/shared/constants';
import type { BodyProfile } from '../types';
import type { CalorieProfile } from '@my-hub/shared/types';

export { profileToTargets } from '@my-hub/shared/utils';

export function rowToProfile(row: CalorieProfile): BodyProfile {
  return {
    updatedAt: row.updatedAt.toISOString(),
    // Resolved against the default rather than passed through: this is what the assistant reads
    // to answer "how much should I eat on a gym day", and a null here would read as "no bonus"
    // when the planner in fact applies 300. Same fallback `calories_plan_week` uses.
    gymDayCalorieBonus: row.gymDayCalorieBonus ?? DEFAULT_GYM_DAY_CALORIE_BONUS,
    ...omitNullish({
      age: row.age,
      sex: row.sex,
      heightCm: row.heightCm,
      activityLevel: row.activityLevel,
      goalType: row.goalType,
      goalWeeklyRateKg: row.goalWeeklyRateKg,
      goalMinCalories: row.goalMinCalories,
      goalMaxCalories: row.goalMaxCalories,
      goalProtein: row.goalProtein,
      goalCarbs: row.goalCarbs,
      goalFat: row.goalFat,
      gymDays: row.gymDays ?? undefined,
      gymTime: row.gymTime,
      notes: row.notes,
    }),
  };
}
