import { z } from 'zod';

import { isoMonthSchema } from '@/lib/schemas/common';

export const CalendarQuerySchema = z.object({ month: isoMonthSchema });

export const CalendarDaySchema = z.object({
  date: z.string(),
  kcal: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  mealCount: z.number().int().nonnegative(),
  /** Ceiling for the day, gym-day bonus included. Null when the profile can't produce a target. */
  target: z.number().nullable(),
  /** Floor for the day, gym-day bonus included. Null when the profile sets no minimum. */
  min: z.number().nullable(),
  isGymDay: z.boolean(),
  /** Whether a weekly menu has a planned meal for this day. */
  hasMenu: z.boolean(),
  /** True only when `hasMenu` and every one of that day's planned meals has been logged. */
  menuLogged: z.boolean(),
});

export const CalendarResponseSchema = z.object({ days: z.array(CalendarDaySchema) });
