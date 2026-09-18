import { omitNullish, profileToTargets } from '@my-hub/shared/utils';
import { getCalorieProfile, getLatestMeasurementsPerType } from '@my-hub/shared/services';
import { DEFAULT_GYM_DAY_CALORIE_BONUS, MeasurementTypes } from '@my-hub/shared/constants';
import type { BodyProfile } from '../types';
import type { CalorieProfile } from '@my-hub/shared/types';

export { profileToTargets } from '@my-hub/shared/utils';

export interface ProfileSnapshot {
  profile: BodyProfile;
  calculated: {
    tdee: number | null;
    goalCalories: number | null;
    minCalories: number | null;
    maxCalories: number | null;
  };
  latestMeasurements: {
    type: string;
    label: string;
    value: number;
    unit: string;
    date: string;
  }[];
}

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
      goalStartDate: row.goalStartDate,
      goalStartWeightKg: row.goalStartWeightKg,
      goalTargetWeightKg: row.goalTargetWeightKg,
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

/**
 * Reads the stored profile together with the latest body measurements and derives the
 * calorie targets from both. Used by the `calories://profile` resource and the
 * `calories_get_profile` tool so the two can never drift apart.
 *
 * @param userId - Owner of the profile to read.
 * @returns The profile (an empty object when none has been saved yet), the calculated
 *   TDEE and calorie bounds, and the latest reading of every measurement type.
 */
export async function buildProfileSnapshot(userId: string): Promise<ProfileSnapshot> {
  const [profileRow, latestMeasurements] = await Promise.all([
    getCalorieProfile(userId),
    getLatestMeasurementsPerType(userId),
  ]);

  const profile = profileRow ? rowToProfile(profileRow) : {};
  const weightM = latestMeasurements.find(m => m.typeKey === MeasurementTypes.Weight);
  const targets = profileToTargets(profile, weightM?.value);

  return {
    profile,
    calculated: {
      tdee: targets.tdee,
      goalCalories: targets.goalCalories,
      minCalories: targets.minCalories,
      maxCalories: targets.maxCalories,
    },
    latestMeasurements: latestMeasurements.map(m => ({
      type: m.typeKey,
      label: m.typeLabel,
      value: m.value,
      unit: m.typeUnit,
      date: m.date,
    })),
  };
}
