import { dayCalorieTargets } from '@my-hub/shared/utils';
import type { DayTargetProfileLike } from '@my-hub/shared/utils';

/** One date's calorie range as the MCP responses expose it, gym-day bonus included. */
export interface DayTargetFields {
  /** Whether `date` is one of the profile's `gymDays`, judged on the calendar date itself. */
  isGymDay: boolean;
  /** kcal the gym-day bonus added to this date's range — 0 on a recovery day. */
  gymDayBonusApplied: number;
  /** This date's ceiling: the profile's max (or goal) calories plus the bonus. */
  dayTarget: number | null;
  /** This date's floor: the profile's min calories plus the bonus. */
  dayMin: number | null;
}

/**
 * Resolves one date's calorie range through `dayCalorieTargets`, the rule the Hub uses, so the
 * assistant and the Hub never read the same day against different targets.
 *
 * @param profile  - The calorie profile (may be empty).
 * @param weightKg - Latest weight, for the TDEE-derived base when no max override is set.
 * @param date     - YYYY-MM-DD in the user's timezone.
 */
export function dayTargetFields(
  profile: DayTargetProfileLike | null | undefined,
  weightKg: number | null | undefined,
  date: string,
): DayTargetFields {
  const { target, min, isGymDay, gymDayBonus } = dayCalorieTargets(profile, weightKg ?? null, date);
  return {
    isGymDay,
    gymDayBonusApplied: isGymDay ? gymDayBonus : 0,
    dayTarget: target,
    dayMin: min,
  };
}
