import { z } from 'zod';
import { route } from '@/lib/api/route';
import {
  getAccounts,
  getCategories,
  getTransactions,
  getTransactionListItems,
  getAvailableBalance,
  getUserActiveBudget,
  getUserBudgets,
  getBudgetProgress,
  getPortfolioOverview,
  getLoanSummaryForAccount,
} from '@my-hub/shared/services';
import { AccountTypes, TransactionTypes } from '@my-hub/shared/constants';
import { monthToDateRange, shiftMonthStr } from '@my-hub/shared/utils';
import type { GoalAccountDetails } from '@my-hub/shared/constants';
import { supportedCurrencySchema } from '../currency.schema';
import { categoryIconSchema, categoryColorSchema } from '../shared.schema';

export const dashboardCategorySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  icon: categoryIconSchema,
  color: categoryColorSchema,
  spent: z.number(),
});

export const dailySpendingPointSchema = z.object({
  day: z.number().int(),
  current: z.number().nullable(),
  prev: z.number(),
});

export const dashboardGoalSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  balance: z.number(),
  target: z.number(),
});

export const dashboardLoanCardSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  currency: supportedCurrencySchema,
  remainingObligation: z.number(),
  monthsRemaining: z.number().int(),
  payoffDate: z.string(),
});

export const dashboardNeedsAttentionSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  icon: categoryIconSchema,
  color: categoryColorSchema,
  spent: z.number(),
});

export const dashboardPortfolioSchema = z.object({
  currency: supportedCurrencySchema,
  value: z.number().nullable(),
  returnPct: z.number().nullable(),
});

export const dashboardTransactionSchema = z.object({
  id: z.number().int(),
  date: z.string(),
  amount: z.number(),
  type: z.enum(TransactionTypes),
  notes: z.string().nullable(),
  payeeName: z.string().nullable(),
  categoryName: z.string().nullable(),
  categoryColor: categoryColorSchema,
  categoryIcon: categoryIconSchema,
  accountName: z.string(),
  toAccountName: z.string().nullable(),
  addedByInitials: z.string().nullable(),
});

export const availableBudgetSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  defaultCurrency: supportedCurrencySchema,
  isOwner: z.boolean(),
});

export const financeDashboardDataSchema = z.object({
  hasBudget: z.literal(true),
  budgetId: z.number().int(),
  budgetName: z.string(),
  currency: supportedCurrencySchema,
  amountsHidden: z.boolean(),
  availableBalance: z.number(),
  monthlyIncome: z.number(),
  monthlyExpense: z.number(),
  monthlyTransfers: z.number(),
  categories: z.array(dashboardCategorySchema),
  dailySpending: z.array(dailySpendingPointSchema),
  goals: z.array(dashboardGoalSchema),
  recentTransactions: z.array(dashboardTransactionSchema),
  budgetTotal: z.number(),
  budgetSpent: z.number(),
  excludedBudgetCategoriesCount: z.number().int(),
  portfolio: dashboardPortfolioSchema.nullable(),
  loans: z.array(dashboardLoanCardSchema),
  needsAttention: z.array(dashboardNeedsAttentionSchema),
});

export const noBudgetResponseSchema = z.object({
  hasBudget: z.literal(false),
  availableBudgets: z.array(availableBudgetSchema),
});

export const dashboardResponseSchema = z.union([financeDashboardDataSchema, noBudgetResponseSchema]);

export type DashboardCategory = z.infer<typeof dashboardCategorySchema>;
export type DailySpendingPoint = z.infer<typeof dailySpendingPointSchema>;
export type DashboardGoal = z.infer<typeof dashboardGoalSchema>;
export type DashboardLoanCard = z.infer<typeof dashboardLoanCardSchema>;
export type DashboardNeedsAttention = z.infer<typeof dashboardNeedsAttentionSchema>;
export type DashboardPortfolio = z.infer<typeof dashboardPortfolioSchema>;
export type DashboardTransaction = z.infer<typeof dashboardTransactionSchema>;
export type AvailableBudget = z.infer<typeof availableBudgetSchema>;
export type FinanceDashboardData = z.infer<typeof financeDashboardDataSchema>;
export type NoBudgetResponse = z.infer<typeof noBudgetResponseSchema>;
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;

const DashboardQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be YYYY-MM')
    .optional(),
});

export const GET = route({ query: DashboardQuerySchema, response: dashboardResponseSchema })(async ({
  user,
  query,
}) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) {
    const allBudgets = await getUserBudgets(user.id);
    return {
      hasBudget: false,
      availableBudgets: allBudgets.map(b => ({
        id: b.id,
        name: b.name,
        defaultCurrency: b.defaultCurrency,
        isOwner: b.createdByUserId === user.id,
      })),
    };
  }

  const budgetId = budget.id;
  const currency = budget.defaultCurrency;

  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const selectedMonth = query.month ?? currentYearMonth;
  const isCurrentMonth = selectedMonth === currentYearMonth;

  const { fromDate: monthStart, toDate: monthEnd } = monthToDateRange(selectedMonth);
  const monthLastDay = Number(monthEnd.slice(8, 10));
  const today = now.toISOString().slice(0, 10);
  const isFutureMonth = selectedMonth > currentYearMonth;
  const toDate = isCurrentMonth ? today : monthEnd;
  const todayDay = isCurrentMonth ? now.getDate() : isFutureMonth ? 0 : monthLastDay;

  const { fromDate: prevMonthStart, toDate: prevMonthEnd } = monthToDateRange(shiftMonthStr(selectedMonth, -1));

  const [
    accounts,
    categories,
    expenseTxns,
    incomeTxns,
    transferTxns,
    recentTxns,
    availableBalance,
    prevExpenseTxns,
    prevTransferTxns,
    budgetProgress,
    portfolioOverview,
  ] = await Promise.all([
    getAccounts(user.id, budgetId),
    getCategories(user.id, budgetId),
    getTransactions(user.id, budgetId, {
      type: TransactionTypes.Expense,
      fromDate: monthStart,
      toDate,
      limit: 2000,
    }),
    getTransactions(user.id, budgetId, {
      type: TransactionTypes.Income,
      fromDate: monthStart,
      toDate,
      limit: 2000,
    }),
    getTransactions(user.id, budgetId, {
      type: TransactionTypes.Transfer,
      fromDate: monthStart,
      toDate,
      limit: 2000,
    }),
    getTransactionListItems(user.id, budgetId, { limit: 5, fromDate: monthStart, toDate }),
    getAvailableBalance(user.id, budgetId),
    getTransactions(user.id, budgetId, {
      type: TransactionTypes.Expense,
      fromDate: prevMonthStart,
      toDate: prevMonthEnd,
      limit: 2000,
    }),
    getTransactions(user.id, budgetId, {
      type: TransactionTypes.Transfer,
      fromDate: prevMonthStart,
      toDate: prevMonthEnd,
      limit: 2000,
    }),
    getBudgetProgress(user.id, budgetId, selectedMonth),
    getPortfolioOverview(user.id, budgetId),
  ]);

  // Only transfers into a Loan account count as spending (loan repayments).
  // Transfers into Goal/Tracking/Investment accounts are savings/investing, not spending.
  const loanAccountIds = new Set(accounts.filter(a => a.type === AccountTypes.Loan).map(a => a.id));
  const isLoanRepayment = (t: { categoryId: number | null; toAccountId: number | null }) =>
    t.categoryId != null && t.toAccountId != null && loanAccountIds.has(t.toAccountId);

  // Monthly totals
  const monthlyExpense = expenseTxns.reduce((sum, t) => sum + t.amount, 0);
  const monthlyIncome = incomeTxns.reduce((sum, t) => sum + t.amount, 0);
  const monthlyTransfers = transferTxns.reduce((sum, t) => (isLoanRepayment(t) ? sum + t.amount : sum), 0);

  // Single pass: category totals + daily map for current month
  const spentByCategory = new Map<number, number>();
  const currentDayMap = new Map<number, number>();
  for (const t of expenseTxns) {
    if (t.categoryId != null) {
      spentByCategory.set(t.categoryId, (spentByCategory.get(t.categoryId) ?? 0) + t.amount);
    }
    const day = +t.date.slice(8, 10);
    currentDayMap.set(day, (currentDayMap.get(day) ?? 0) + t.amount);
  }
  for (const t of transferTxns) {
    if (isLoanRepayment(t)) {
      spentByCategory.set(t.categoryId!, (spentByCategory.get(t.categoryId!) ?? 0) + t.amount);
      const day = +t.date.slice(8, 10);
      currentDayMap.set(day, (currentDayMap.get(day) ?? 0) + t.amount);
    }
  }

  const prevDayMap = new Map<number, number>();
  for (const t of prevExpenseTxns) {
    const day = +t.date.slice(8, 10);
    prevDayMap.set(day, (prevDayMap.get(day) ?? 0) + t.amount);
  }
  for (const t of prevTransferTxns) {
    if (isLoanRepayment(t)) {
      const day = +t.date.slice(8, 10);
      prevDayMap.set(day, (prevDayMap.get(day) ?? 0) + t.amount);
    }
  }

  // All categories with spending this month (for pie chart)
  let categorizedTotal = 0;
  for (const v of spentByCategory.values()) categorizedTotal += v;

  const categorySpending = categories
    .filter(c => (spentByCategory.get(c.id) ?? 0) > 0)
    .sort((a, b) => (spentByCategory.get(b.id) ?? 0) - (spentByCategory.get(a.id) ?? 0))
    .map(c => ({
      id: c.id,
      name: c.name,
      icon: c.icon ?? null,
      color: c.color ?? null,
      spent: spentByCategory.get(c.id)!,
    }));

  const uncategorized = monthlyExpense - categorizedTotal;
  if (uncategorized > 0.01) {
    categorySpending.push({ id: -1, name: 'Other', icon: null, color: null, spent: uncategorized });
  }

  const dailySpending: { day: number; current: number | null; prev: number }[] = [];
  let currentCumulative = 0;
  let prevCumulative = 0;
  for (let d = 1; d <= monthLastDay; d++) {
    if (d <= todayDay) {
      currentCumulative += currentDayMap.get(d) ?? 0;
    }
    prevCumulative += prevDayMap.get(d) ?? 0;
    dailySpending.push({ day: d, current: d <= todayDay ? currentCumulative : null, prev: prevCumulative });
  }

  // Goals — accounts of type 'goal'
  const goals = accounts
    .filter(a => a.type === AccountTypes.Goal)
    .map(a => {
      const details = a.details as GoalAccountDetails | null;
      return {
        id: a.id,
        name: a.name,
        balance: a.balance,
        target: details?.targetAmount ?? 0,
      };
    })
    .filter(g => g.target > 0);

  // Categories excluded from the aggregate budget total (see getBudgetProgress) but that still
  // have a target set — shown as a caption on the widget's budget bar.
  const excludedBudgetCategoriesCount = categories.filter(
    c => c.monthlyTarget != null && !c.includeInSpendingBudget,
  ).length;

  const portfolio = portfolioOverview
    ? {
        currency: portfolioOverview.portfolio.baseCurrency,
        value: portfolioOverview.totals.currentValue,
        returnPct: portfolioOverview.totals.profitPct,
      }
    : null;

  // Loans flagged for the widget — 0..N dedicated cards, ordered by widgetSortOrder then name.
  const widgetLoanAccounts = accounts
    .filter(a => a.type === AccountTypes.Loan && a.showOnWidget)
    .sort((a, b) => a.widgetSortOrder - b.widgetSortOrder || a.name.localeCompare(b.name));
  const loans = (
    await Promise.all(
      widgetLoanAccounts.map(async account => {
        const summary = await getLoanSummaryForAccount(user.id, budgetId, account);
        if (!summary) return null;
        return {
          id: account.id,
          name: account.name,
          currency: account.currency,
          remainingObligation: summary.remainingObligation,
          monthsRemaining: summary.paymentsRemaining,
          payoffDate: summary.projectedPayoffDate,
        };
      }),
    )
  ).filter(loan => loan !== null);

  // Categories with spend this month but no monthly target set — surfaced so they don't go unnoticed.
  const needsAttention = categories
    .filter(c => c.monthlyTarget == null && (spentByCategory.get(c.id) ?? 0) > 0)
    .map(c => ({
      id: c.id,
      name: c.name,
      icon: c.icon ?? null,
      color: c.color ?? null,
      spent: spentByCategory.get(c.id)!,
    }))
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 3);

  const data: FinanceDashboardData = {
    hasBudget: true,
    budgetId,
    budgetName: budget.name,
    currency,
    amountsHidden: budget.amountsHidden,
    availableBalance,
    monthlyIncome,
    monthlyExpense,
    monthlyTransfers,
    categories: categorySpending,
    dailySpending,
    goals,
    recentTransactions: recentTxns,
    budgetTotal: budgetProgress.totalBudgeted,
    budgetSpent: budgetProgress.totalSpent,
    excludedBudgetCategoriesCount,
    portfolio,
    loans,
    needsAttention,
  };

  return data;
});
