import { z } from 'zod';
import { LeaveStatusValues, SalaryKindValues } from '@my-hub/shared/constants';
import { isoDateSchema, isoMonthSchema } from '@/lib/schemas/common';

const includeDraftRules = z.stringbool().optional();

export const VacationCalendarQuerySchema = z.object({ month: isoMonthSchema, includeDraftRules });

export const VacationSpanQuerySchema = z.object({
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  includeDraftRules,
});

export const VacationBalanceQuerySchema = z.object({ date: isoDateSchema, includeDraftRules });

export const VacationLeaveQuerySchema = z.object({ includeDraftRules });

const optionalText = z.string().trim().max(500).nullish();

/** Body of `PUT /api/vacation/profile`. Every field is required, since the page always saves the whole form. */
export const VacationProfileBodySchema = z.object({
  country: z.string().trim().length(2, 'must be a 2-letter country code'),
  region: optionalText,
  employer: z.string().trim().min(1).max(200),
  openingBalanceDays: z.number().min(0),
  openingBalanceDate: isoDateSchema,
  accrualStart: isoDateSchema.nullish(),
  baseSalaryMdl: z.number().min(0).nullish(),
});

/** Body of `POST /api/vacation/leave` — omit `id` to record new leave, pass it to overwrite. */
export const VacationLeaveBodySchema = z.object({
  id: z.number().int().positive().optional(),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  status: z.enum(LeaveStatusValues),
  payReceivedMdl: z.number().min(0).nullish(),
  notes: optionalText,
});

/** Body of `PUT /api/vacation/salaries` — salaries are keyed by month, so this is an upsert. */
export const VacationSalaryBodySchema = z.object({
  month: isoMonthSchema,
  baseMdl: z.number().min(0),
  extraMdl: z.number().min(0).optional(),
  kind: z.enum(SalaryKindValues),
  notes: optionalText,
});
