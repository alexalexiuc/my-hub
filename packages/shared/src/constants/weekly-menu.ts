/**
 * Weekly menu domain constants.
 */
import { dayNamesShort } from './calendar';

export const DaysOfWeek = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
} as const;

export type DayOfWeek = (typeof DaysOfWeek)[keyof typeof DaysOfWeek];
export const DaysOfWeekValues: DayOfWeek[] = Object.values(DaysOfWeek);

export const DAY_LABELS: Record<DayOfWeek, string> = {
  0: 'Monday',
  1: 'Tuesday',
  2: 'Wednesday',
  3: 'Thursday',
  4: 'Friday',
  5: 'Saturday',
  6: 'Sunday',
};

// Derived from the calendar constant (also Monday-indexed) so the two can never drift.
export const DAY_LABELS_SHORT: Record<DayOfWeek, string> = Object.fromEntries(
  DaysOfWeekValues.map(d => [d, dayNamesShort[d]!]),
) as Record<DayOfWeek, string>;
