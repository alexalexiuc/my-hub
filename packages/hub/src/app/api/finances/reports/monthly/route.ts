import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { getUserActiveBudget, getMonthlyFinanceReport } from '@my-hub/shared/services';
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

const accountFlowSchema = z.object({
  accountId: z.number(),
  accountName: z.string(),
  accountType: z.string(),
  currency: z.string(),
  openingBalance: z.number(),
  closingBalance: z.number(),
  inflows: z.number(),
  outflows: z.number(),
  netDelta: z.number(),
  reconciles: z.boolean(),
});
const accountFlowsSchema = z.object({ dateFrom: z.string(), dateTo: z.string(), accounts: z.array(accountFlowSchema) });

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

const categoryProgressSchema = z.object({
  id: z.number(),
  name: z.string(),
  displayName: z.string(),
  monthlyTarget: z.number().nullable(),
  spent: z.number(),
  remainingBudget: z.number().nullable(),
  percentUsed: z.number().nullable(),
});
const budgetProgressSchema = z.object({
  month: z.string(),
  totalBudgeted: z.number(),
  totalSpent: z.number(),
  categories: z.array(categoryProgressSchema),
});

const categorySpikeSchema = z.object({
  categoryId: z.number().optional(),
  categoryName: z.string(),
  currentSpend: z.number(),
  trailingAvg: z.number(),
  percentChange: z.number(),
});
const goalProgressSchema = z.object({
  accountId: z.number(),
  accountName: z.string(),
  currency: z.string(),
  balance: z.number(),
  targetAmount: z.number().nullable(),
  percentComplete: z.number().nullable(),
  contributionThisPeriod: z.number(),
});
const loanProgressSchema = z.object({
  accountId: z.number(),
  accountName: z.string(),
  currency: z.string(),
  remainingBalance: z.number(),
  paidDownThisPeriod: z.number(),
});

const monthlyReportSchema = z.object({
  month: z.string(),
  dateFrom: z.string(),
  dateTo: z.string(),
  cashflow: cashflowSchema,
  accountFlows: accountFlowsSchema,
  savingsContributions: savingsContributionsSchema,
  budgetProgress: budgetProgressSchema,
  insights: z.object({
    categorySpikes: z.array(categorySpikeSchema),
    newPayees: z.array(z.object({ payeeId: z.number(), name: z.string(), totalSpent: z.number() })),
    dataQualityFlags: z.array(z.object({ accountId: z.number(), accountName: z.string() })),
    goals: z.array(goalProgressSchema),
    loans: z.array(loanProgressSchema),
  }),
});

export const monthlyReportResponseSchema = z.object({
  currency: supportedCurrencySchema,
  report: monthlyReportSchema,
});

export type MonthlyReportData = z.infer<typeof monthlyReportResponseSchema>;

const QuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

export const GET = route({ query: QuerySchema, response: monthlyReportResponseSchema })(async ({ user, query }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const report = await getMonthlyFinanceReport(user.id, budget.id, query.month);

  return { currency: budget.defaultCurrency, report };
});
