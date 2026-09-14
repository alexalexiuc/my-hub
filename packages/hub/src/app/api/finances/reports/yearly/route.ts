import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { getUserActiveBudget, getYearlyFinanceReport } from '@my-hub/shared/services';
import { supportedCurrencySchema } from '../../currency.schema';
import { moneyAmountSchema } from '../../money.schema';

const monthCashflowSchema = z.object({ month: z.string(), income: z.number(), expenses: z.number(), net: z.number() });
const cashflowSchema = z.object({
  dateFrom: z.string(),
  dateTo: z.string(),
  totalIncome: z.number(),
  totalExpenses: z.number(),
  net: z.number(),
  byMonth: z.array(monthCashflowSchema),
});

const netWorthHistoryEntrySchema = z.object({ month: z.string(), netWorth: z.number() });

const accountContributionSchema = z.object({
  accountId: z.number(),
  accountName: z.string(),
  accountType: z.string(),
  original: moneyAmountSchema,
  converted: moneyAmountSchema,
});
const savingsContributionsSchema = z.object({
  dateFrom: z.string(),
  dateTo: z.string(),
  totalNetContribution: moneyAmountSchema,
  accounts: z.array(accountContributionSchema),
  previousPeriod: z.object({ dateFrom: z.string(), dateTo: z.string(), totalNetContribution: moneyAmountSchema }),
});

const ibkrDcaSchema = z.object({ actualContributed: z.number(), targetContribution: z.number(), currency: z.string() });

const loanPayoffProgressSchema = z.object({
  accountId: z.number(),
  accountName: z.string(),
  currency: z.string(),
  remainingBalance: z.number(),
  paidDownThisYear: z.number(),
});

const categoryByMonthSchema = z.object({
  categoryId: z.number().optional(),
  categoryName: z.string(),
  months: z.record(z.string(), z.number()),
});

const comparisonGroupSchema = z.object({
  key: z.string(),
  id: z.number().optional(),
  period1: z.object({ transactionCount: z.number(), total: z.number(), average: z.number() }),
  period2: z.object({ transactionCount: z.number(), total: z.number(), average: z.number() }),
  absoluteDelta: z.number(),
  percentDelta: z.number().nullable(),
});
const comparisonSchema = z.object({
  period1: z.object({ dateFrom: z.string(), dateTo: z.string() }),
  period2: z.object({ dateFrom: z.string(), dateTo: z.string() }),
  groupBy: z.string(),
  groups: z.array(comparisonGroupSchema),
});

const yearlyReportSchema = z.object({
  year: z.number(),
  dateFrom: z.string(),
  dateTo: z.string(),
  cashflow: cashflowSchema,
  netWorthHistory: z.array(netWorthHistoryEntrySchema),
  netWorthDelta: z.number().nullable(),
  savingsContributions: savingsContributionsSchema,
  ibkrDca: ibkrDcaSchema.nullable(),
  loans: z.array(loanPayoffProgressSchema),
  categoryByMonth: z.array(categoryByMonthSchema),
  yearOverYear: comparisonSchema,
});

export const yearlyReportResponseSchema = z.object({
  currency: supportedCurrencySchema,
  report: yearlyReportSchema,
});

export type YearlyReportData = z.infer<typeof yearlyReportResponseSchema>;

const QuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const GET = route({ query: QuerySchema, response: yearlyReportResponseSchema })(async ({ user, query }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const report = await getYearlyFinanceReport(user.id, budget.id, query.year);

  return { currency: budget.defaultCurrency, report };
});
