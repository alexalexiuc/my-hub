import { z } from 'zod';
import { isoDateSchema, isoMonthSchema } from '@/lib/schemas/common';

const includeDraftRules = z.stringbool().optional();

export const VacationCalendarQuerySchema = z.object({ month: isoMonthSchema, includeDraftRules });

export const VacationSpanQuerySchema = z.object({
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  includeDraftRules,
});

export const VacationBalanceQuerySchema = z.object({ date: isoDateSchema, includeDraftRules });
