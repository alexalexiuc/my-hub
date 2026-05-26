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
} from '@my-hub/shared/services';
import { AccountTypes, TransactionTypes } from '@my-hub/shared/constants';
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
  availableBalance: z.number(),
  monthlyIncome: z.number(),
  monthlyExpense: z.number(),
  monthlyTransfers: z.number(),
  categories: z.array(dashboardCategorySchema),
  dailySpending: z.array(dailySpendingPointSchema),
  goals: z.array(dashboardGoalSchema),
  recentTransactions: z.array(dashboardTransactionSchema),
});

export const noBudgetResponseSchema = z.object({
  hasBudget: z.literal(false),
  availableBudgets: z.array(availableBudgetSchema),
});

export const dashboardResponseSchema = z.union([financeDashboardDataSchema, noBudgetResponseSchema]);

export type DashboardCategory = z.infer<typeof dashboardCategorySchema>;
export type DailySpendingPoint = z.infer<typeof dailySpendingPointSchema>;
export type DashboardGoal = z.infer<typeof dashboardGoalSchema>;
export type DashboardTransaction = z.infer<typeof dashboardTransactionSchema>;
export type AvailableBudget = z.infer<typeof availableBudgetSchema>;
export type FinanceDashboardData = z.infer<typeof financeDashboardDataSchema>;
export type NoBudgetResponse = z.infer<typeof noBudgetResponseSchema>;
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;

const DashboardQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM')
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
  const [selYear, selMon] = selectedMonth.split('-').map(Number) as [number, number];
  const isCurrentMonth = selectedMonth === currentYearMonth;

  const monthStart = `${selectedMonth}-01`;
  const monthLastDay = new Date(selYear, selMon, 0).getDate();
  const monthEnd = `${selectedMonth}-${String(monthLastDay).padStart(2, '0')}`;
  const today = now.toISOString().slice(0, 10);
  const toDate = isCurrentMonth ? today : monthEnd;
  const todayDay = isCurrentMonth ? now.getDate() : monthLastDay;

  const prevMonthDate = new Date(selYear, selMon - 2, 1);
  const prevYear = prevMonthDate.getFullYear();
  const prevMonth = prevMonthDate.getMonth() + 1;
  const prevMonthStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
  const prevMonthLastDay = new Date(selYear, selMon - 1, 0).getDate();
  const prevMonthEnd = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevMonthLastDay).padStart(2, '0')}`;

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
    getTransactionListItems(user.id, budgetId, { limit: 5 }),
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
  ]);

  // Monthly totals
  const monthlyExpense = expenseTxns.reduce((sum, t) => sum + t.amount, 0);
  const monthlyIncome = incomeTxns.reduce((sum, t) => sum + t.amount, 0);
  const monthlyTransfers = transferTxns.reduce((sum, t) => (t.categoryId != null ? sum + t.amount : sum), 0);

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
    if (t.categoryId != null) {
      spentByCategory.set(t.categoryId, (spentByCategory.get(t.categoryId) ?? 0) + t.amount);
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
    if (t.categoryId != null) {
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

  const data: FinanceDashboardData = {
    hasBudget: true,
    budgetId,
    budgetName: budget.name,
    currency,
    availableBalance,
    monthlyIncome,
    monthlyExpense,
    monthlyTransfers,
    categories: categorySpending,
    dailySpending,
    goals,
    recentTransactions: recentTxns,
  };

  return data;
});
