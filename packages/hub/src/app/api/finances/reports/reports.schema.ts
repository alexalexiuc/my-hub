import { z } from 'zod';
import { supportedCurrencySchema } from '../currency.schema';

export const reportsCashflowMonthSchema = z.object({
  /** YYYY-MM. */
  month: z.string(),
  income: z.number(),
  expense: z.number(),
});

export const reportsResponseSchema = z.object({
  currency: supportedCurrencySchema,
  /** The calendar year the figures cover. */
  year: z.number().int(),
  /** One entry per month of `year`, oldest first — capped at the current month for the ongoing year. */
  cashflow: z.array(reportsCashflowMonthSchema),
});

/** Widest year a caller may ask for — guards against an unbounded scan from a hand-typed URL. */
export const MIN_REPORT_YEAR = 1970;
export const MAX_REPORT_YEAR = 2999;

export const reportsQuerySchema = z.object({
  /** Calendar year to report on. Defaults to the current year. */
  year: z.coerce.number().int().min(MIN_REPORT_YEAR).max(MAX_REPORT_YEAR).optional(),
});

export type CashflowMonth = z.infer<typeof reportsCashflowMonthSchema>;
export type ReportsData = z.infer<typeof reportsResponseSchema>;
