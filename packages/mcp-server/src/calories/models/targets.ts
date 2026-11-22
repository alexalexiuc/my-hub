import type { DayCalorieTargets } from '@my-hub/shared/utils';

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

/** A day's range (from `getDayTargets` / `getDayTargetsForRange`) in the MCP response shape. */
export function toDayTargetFields({ target, min, isGymDay, gymDayBonus }: DayCalorieTargets): DayTargetFields {
  return {
    isGymDay,
    gymDayBonusApplied: isGymDay ? gymDayBonus : 0,
    dayTarget: target,
    dayMin: min,
  };
}
