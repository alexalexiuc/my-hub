/**
 * Weekly menu domain constants.
 */
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

export const DAY_LABELS_SHORT: Record<DayOfWeek, string> = {
  0: 'Mon',
  1: 'Tue',
  2: 'Wed',
  3: 'Thu',
  4: 'Fri',
  5: 'Sat',
  6: 'Sun',
};
