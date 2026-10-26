import { z } from 'zod';

import { isoDateSchema, isoMonthSchema } from '@/lib/schemas/common';

/** A whole month (`month`), or an explicit inclusive range (`dateFrom` + `dateTo`, capped by the route). */
export const CalendarQuerySchema = z
  .object({
    month: isoMonthSchema.optional(),
    dateFrom: isoDateSchema.optional(),
    dateTo: isoDateSchema.optional(),
  })
  .refine(q => q.month || (q.dateFrom && q.dateTo && q.dateFrom <= q.dateTo), {
    message: 'Pass month, or dateFrom and dateTo with dateFrom <= dateTo',
  });

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
