import type { z } from 'zod';
import type { CalendarDaySchema } from '@/app/api/calories/calendar/calendar.schemas';

/** One day's kcal/macro totals plus its target, as returned by `GET /api/calories/calendar`. */
export type CalendarDay = z.infer<typeof CalendarDaySchema>;
