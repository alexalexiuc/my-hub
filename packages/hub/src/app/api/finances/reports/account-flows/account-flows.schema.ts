import { z } from 'zod';
import { AccountTypes } from '@my-hub/shared/constants';
import { supportedCurrencySchema } from '../../currency.schema';
import { MAX_REPORT_YEAR, MIN_REPORT_YEAR } from '../reports.schema';

export const accountMonthFlowSchema = z.object({
  /** YYYY-MM. */
  month: z.string(),
  inflows: z.number(),
  outflows: z.number(),
  /** inflows - outflows */
  net: z.number(),
});

export const monthlyAccountFlowSchema = z.object({
  accountId: z.number().int(),
  accountName: z.string(),
  accountType: z.enum(AccountTypes),
  /** The account's own currency — every figure on this row is denominated in it. */
  currency: z.string(),
  /** One entry per month in the window, oldest first, zero-filled. */
  months: z.array(accountMonthFlowSchema),
  totalInflows: z.number(),
  totalOutflows: z.number(),
  net: z.number(),
});

export const accountFlowsReportResponseSchema = z.object({
  /** Budget default currency — a display fallback; each account row carries its own currency. */
  currency: supportedCurrencySchema,
  year: z.number().int(),
  /** Every YYYY-MM in the window, oldest first. */
  months: z.array(z.string()),
  accounts: z.array(monthlyAccountFlowSchema),
});

export const accountFlowsQuerySchema = z.object({
  /** Calendar year to report on. Defaults to the current year. */
  year: z.coerce.number().int().min(MIN_REPORT_YEAR).max(MAX_REPORT_YEAR).optional(),
});

export type AccountMonthFlow = z.infer<typeof accountMonthFlowSchema>;
export type MonthlyAccountFlow = z.infer<typeof monthlyAccountFlowSchema>;
export type AccountFlowsReportData = z.infer<typeof accountFlowsReportResponseSchema>;
