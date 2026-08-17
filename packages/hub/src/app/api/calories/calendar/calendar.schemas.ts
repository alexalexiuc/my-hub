import { z } from 'zod';

/** A calendar month as YYYY-MM — the query shape for the Calendar month view. */
export const isoMonthSchema = z.string().regex(/^\d{4}-\d{2}$/, 'must be YYYY-MM');

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
});

export const CalendarResponseSchema = z.object({ days: z.array(CalendarDaySchema) });
