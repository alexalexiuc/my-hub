import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import {
  getUserActiveBudget,
  getTransactionListItems,
  getTransactions,
  getAccountById,
  getAccountsCashflow,
} from '@my-hub/shared/services';
import type { CategoryIcon } from '@my-hub/shared/constants';
import { TransactionTypes, CASHFLOW_ACCOUNT_TYPES } from '@my-hub/shared/constants';
import { monthToDateRange, shiftMonthStr, addDays, dateToString } from '@my-hub/shared/utils';
import { supportedCurrencySchema } from '../currency.schema';
import { categoryIconSchema, categoryColorSchema } from '../shared.schema';

const summarySchema = z.object({
  totalExpenses: z.number(),
  totalIncome: z.number(),
  net: z.number(),
  transactionCount: z.number().int(),
});

const dailyPointSchema = z.object({
  day: z.number().int(),
  current: z.number().nullable(),
  prev: z.number(),
});

const categoryBreakdownItemSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  color: categoryColorSchema,
  icon: categoryIconSchema,
  amount: z.number(),
  prevAmount: z.number(),
  pct: z.number(),
});

const payeeItemSchema = z.object({
  payeeId: z.number().int(),
  name: z.string(),
  transactionCount: z.number().int(),
  totalSpent: z.number(),
  prevSpent: z.number(),
});

const cashflowMonthSchema = z.object({
  month: z.string(),
  label: z.string(),
  income: z.number(),
  expense: z.number(),
});

const accountCashflowSchema = z.object({
  accountId: z.number().int(),
  accountName: z.string(),
  currency: supportedCurrencySchema,
  income: z.number(),
  expenses: z.number(),
  net: z.number(),
});

export const reportingResponseSchema = z.object({
  currency: supportedCurrencySchema,
  dateMode: z.enum(['month', 'range', 'all']),
  fromDate: z.string(),
  toDate: z.string(),
  prevFromDate: z.string().nullable(),
  prevToDate: z.string().nullable(),
  summary: summarySchema,
  prevSummary: summarySchema.nullable(),
  dailySpending: z.array(dailyPointSchema).nullable(),
  categoryBreakdown: z.array(categoryBreakdownItemSchema),
  topPayees: z.array(payeeItemSchema),
  cashflowByMonth: z.array(cashflowMonthSchema).nullable(),
  accountCashflow: accountCashflowSchema.nullable(),
});

export type ReportingData = z.infer<typeof reportingResponseSchema>;
export type ReportingCategoryItem = z.infer<typeof categoryBreakdownItemSchema>;
export type ReportingPayeeItem = z.infer<typeof payeeItemSchema>;
export type ReportingCashflowMonth = z.infer<typeof cashflowMonthSchema>;
export type ReportingAccountCashflow = z.infer<typeof accountCashflowSchema>;

const QuerySchema = z.object({
  dateMode: z.enum(['month', 'range', 'all']).default('month'),
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  fromDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  toDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  type: z.enum(TransactionTypes).optional(),
  accountId: z.coerce.number().int().optional(),
  categoryId: z.coerce.number().int().optional(),
  label: z.string().optional(),
  amountGte: z.coerce.number().optional(),
  amountLte: z.coerce.number().optional(),
  search: z.string().optional(),
});

export const GET = route({ query: QuerySchema, response: reportingResponseSchema })(async ({ user, query }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const budgetId = budget.id;
  const currency = budget.defaultCurrency;
  const today = dateToString();
  const currentMonthStr = today.slice(0, 7);
  const monthStr = query.month ?? currentMonthStr;

  // Resolve date ranges
  let fromDate: string;
  let toDate: string;
  let prevFromDate: string | null = null;
  let prevToDate: string | null = null;
  let monthLastDay = 0;

  if (query.dateMode === 'month') {
    ({ fromDate, toDate } = monthToDateRange(monthStr));
    monthLastDay = Number(toDate.slice(8, 10));
    if (monthStr === currentMonthStr && toDate > today) toDate = today;
    const prevMonth = shiftMonthStr(monthStr, -1);
    ({ fromDate: prevFromDate, toDate: prevToDate } = monthToDateRange(prevMonth));
  } else if (query.dateMode === 'range') {
    fromDate = query.fromDate ?? `${currentMonthStr}-01`;
    toDate = query.toDate ?? today;
    const daysDiff = Math.round((new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000);
    const prevToDateObj = addDays(new Date(fromDate + 'T00:00:00Z'), -1);
    const prevFromDateObj = addDays(prevToDateObj, -Math.max(daysDiff, 0));
    prevToDate = prevToDateObj.toISOString().slice(0, 10);
    prevFromDate = prevFromDateObj.toISOString().slice(0, 10);
  } else {
    fromDate = '2000-01-01';
    toDate = today;
  }

  const filterOpts = {
    accountId: query.accountId,
    categoryId: query.categoryId,
    label: query.label || undefined,
    amountGte: query.amountGte,
    amountLte: query.amountLte,
    search: query.search || undefined,
    limit: 5000,
  };

  // Per-account income vs spending (only computed when an account filter is active)
  const accountCashflowPromise = query.accountId
    ? Promise.all([
        getAccountById(user.id, budgetId, query.accountId),
        getAccountsCashflow(user.id, budgetId, fromDate, toDate, [query.accountId]),
      ])
    : Promise.resolve(null);

  // Determine which type to use for the breakdown (expense by default, income if explicitly set)
  const breakdownType = query.type === TransactionTypes.Income ? TransactionTypes.Income : TransactionTypes.Expense;
  const summaryType = query.type; // undefined = fetch both

  // Categorized transfers (e.g. loan repayments) are counted as spending on the dashboard,
  // so the spending trend needs them too for the two charts to agree.
  const includeTransfers = query.dateMode === 'month' && breakdownType === TransactionTypes.Expense;

  // Fetch all needed transactions in parallel
  const [breakdownTxns, prevBreakdownTxns, incomeTxns, prevIncomeTxns, transferTxns, prevTransferTxns] =
    await Promise.all([
      // Current period breakdown transactions (expense or income based on filter)
      getTransactionListItems(user.id, budgetId, {
        ...filterOpts,
        type: summaryType ?? breakdownType,
        fromDate,
        toDate,
      }),
      // Previous period breakdown transactions
      prevFromDate && prevToDate
        ? getTransactions(user.id, budgetId, {
            ...filterOpts,
            type: summaryType ?? breakdownType,
            fromDate: prevFromDate,
            toDate: prevToDate,
            limit: 5000,
          })
        : Promise.resolve([]),
      // Income for summary context (only when no type filter or expense filter)
      !summaryType || summaryType === TransactionTypes.Expense
        ? getTransactions(user.id, budgetId, {
            ...filterOpts,
            type: TransactionTypes.Income,
            fromDate,
            toDate,
            limit: 5000,
          })
        : Promise.resolve([]),
      // Previous income for comparison
      prevFromDate && prevToDate && (!summaryType || summaryType === TransactionTypes.Expense)
        ? getTransactions(user.id, budgetId, {
            ...filterOpts,
            type: TransactionTypes.Income,
            fromDate: prevFromDate,
            toDate: prevToDate,
            limit: 5000,
          })
        : Promise.resolve([]),
      // Categorized transfers for the current period (counted as spending, like the dashboard)
      includeTransfers
        ? getTransactions(user.id, budgetId, {
            ...filterOpts,
            type: TransactionTypes.Transfer,
            fromDate,
            toDate,
            limit: 5000,
          })
        : Promise.resolve([]),
      // Categorized transfers for the previous period
      includeTransfers && prevFromDate && prevToDate
        ? getTransactions(user.id, budgetId, {
            ...filterOpts,
            type: TransactionTypes.Transfer,
            fromDate: prevFromDate,
            toDate: prevToDate,
            limit: 5000,
          })
        : Promise.resolve([]),
    ]);

  // Compute totals
  const expenseTxns =
    breakdownType === TransactionTypes.Expense || summaryType === TransactionTypes.Expense ? breakdownTxns : [];
  const totalExpenses = expenseTxns.reduce((s, t) => s + t.amount, 0);
  const totalIncome =
    summaryType === TransactionTypes.Income
      ? breakdownTxns.reduce((s, t) => s + t.amount, 0)
      : incomeTxns.reduce((s, t) => s + t.amount, 0);

  const prevExpenseTxns =
    breakdownType === TransactionTypes.Expense || summaryType === TransactionTypes.Expense ? prevBreakdownTxns : [];
  const prevTotalExpenses = prevExpenseTxns.reduce((s, t) => s + t.amount, 0);
  const prevTotalIncome =
    summaryType === TransactionTypes.Income
      ? prevBreakdownTxns.reduce((s, t) => s + t.amount, 0)
      : prevIncomeTxns.reduce((s, t) => s + t.amount, 0);

  const summary = {
    totalExpenses,
    totalIncome,
    net: totalIncome - totalExpenses,
    transactionCount: breakdownTxns.length,
  };

  const prevSummary =
    prevFromDate && prevToDate
      ? {
          totalExpenses: prevTotalExpenses,
          totalIncome: prevTotalIncome,
          net: prevTotalIncome - prevTotalExpenses,
          transactionCount: prevBreakdownTxns.length,
        }
      : null;

  // Category breakdown
  let totalForPct = 0;
  const categoryMap = new Map<
    number,
    { name: string; color: string | null; icon: CategoryIcon | null; amount: number }
  >();
  for (const t of breakdownTxns) {
    if (t.categoryId == null) continue;
    totalForPct += t.amount;
    const existing = categoryMap.get(t.categoryId);
    if (existing) {
      existing.amount += t.amount;
    } else {
      categoryMap.set(t.categoryId, {
        name: t.categoryName ?? 'Unknown',
        color: t.categoryColor ?? null,
        icon: (t.categoryIcon as CategoryIcon | null) ?? null,
        amount: t.amount,
      });
    }
  }

  const prevCategoryMap = new Map<number, number>();
  for (const t of prevBreakdownTxns) {
    if (t.categoryId == null) continue;
    prevCategoryMap.set(t.categoryId, (prevCategoryMap.get(t.categoryId) ?? 0) + t.amount);
  }
  const categoryBreakdown = Array.from(categoryMap.entries())
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 12)
    .map(([id, c]) => ({
      id,
      name: c.name,
      color: c.color,
      icon: c.icon,
      amount: Math.round(c.amount * 100) / 100,
      prevAmount: Math.round((prevCategoryMap.get(id) ?? 0) * 100) / 100,
      pct: totalForPct > 0 ? Math.round((c.amount / totalForPct) * 1000) / 10 : 0,
    }));

  // Top payees
  const payeeMap = new Map<number, { name: string; count: number; total: number }>();
  for (const t of breakdownTxns) {
    if (t.payeeId == null) continue;
    const existing = payeeMap.get(t.payeeId);
    if (existing) {
      existing.count++;
      existing.total += t.amount;
    } else {
      payeeMap.set(t.payeeId, { name: t.payeeName ?? 'Unknown', count: 1, total: t.amount });
    }
  }

  const prevPayeeMap = new Map<number, number>();
  for (const t of prevBreakdownTxns) {
    if (t.payeeId == null) continue;
    prevPayeeMap.set(t.payeeId, (prevPayeeMap.get(t.payeeId) ?? 0) + t.amount);
  }

  const topPayees = Array.from(payeeMap.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .map(([payeeId, p]) => ({
      payeeId,
      name: p.name,
      transactionCount: p.count,
      totalSpent: Math.round(p.total * 100) / 100,
      prevSpent: Math.round((prevPayeeMap.get(payeeId) ?? 0) * 100) / 100,
    }));

  // Daily spending (month mode only)
  let dailySpending: { day: number; current: number | null; prev: number }[] | null = null;
  if (query.dateMode === 'month') {
    const todayDay = monthStr === currentMonthStr ? new Date().getDate() : monthLastDay;

    const currentDayMap = new Map<number, number>();
    for (const t of breakdownTxns) {
      const day = +t.date.slice(8, 10);
      currentDayMap.set(day, (currentDayMap.get(day) ?? 0) + t.amount);
    }
    for (const t of transferTxns) {
      if (t.categoryId != null) {
        const day = +t.date.slice(8, 10);
        currentDayMap.set(day, (currentDayMap.get(day) ?? 0) + t.amount);
      }
    }
    const prevDayMap = new Map<number, number>();
    for (const t of prevBreakdownTxns) {
      const day = +t.date.slice(8, 10);
      prevDayMap.set(day, (prevDayMap.get(day) ?? 0) + t.amount);
    }
    for (const t of prevTransferTxns) {
      if (t.categoryId != null) {
        const day = +t.date.slice(8, 10);
        prevDayMap.set(day, (prevDayMap.get(day) ?? 0) + t.amount);
      }
    }

    let currentCumulative = 0;
    let prevCumulative = 0;
    dailySpending = [];
    for (let d = 1; d <= monthLastDay; d++) {
      if (d <= todayDay) currentCumulative += currentDayMap.get(d) ?? 0;
      prevCumulative += prevDayMap.get(d) ?? 0;
      dailySpending.push({ day: d, current: d <= todayDay ? currentCumulative : null, prev: prevCumulative });
    }
  }

  // Cashflow by month (non-month modes)
  let cashflowByMonth: { month: string; label: string; income: number; expense: number }[] | null = null;
  if (query.dateMode !== 'month') {
    const monthMap = new Map<string, { income: number; expense: number }>();
    const addToMonthMap = (t: { date: string; amount: number; type: string }) => {
      const m = t.date.slice(0, 7);
      if (!monthMap.has(m)) monthMap.set(m, { income: 0, expense: 0 });
      const entry = monthMap.get(m)!;
      if (t.type === TransactionTypes.Income) entry.income += t.amount;
      else entry.expense += t.amount;
    };
    for (const t of breakdownTxns) addToMonthMap(t);
    for (const t of incomeTxns) addToMonthMap(t);
    cashflowByMonth = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([m, d]) => ({
        month: m,
        label: new Date(m + '-15').toLocaleDateString('en-IE', { month: 'short', year: '2-digit' }),
        income: Math.round(d.income * 100) / 100,
        expense: Math.round(d.expense * 100) / 100,
      }));
  }

  // Resolve per-account cashflow (if account filter is active, and the account type
  // supports the "Income vs Spending" stat — everyday transaction accounts only)
  let accountCashflow: ReportingAccountCashflow | null = null;
  const accountCashflowResult = await accountCashflowPromise;
  if (accountCashflowResult) {
    const [account, cashflowMap] = accountCashflowResult;
    if (account && CASHFLOW_ACCOUNT_TYPES.has(account.type)) {
      const cf = cashflowMap.get(account.id) ?? { income: 0, expenses: 0, net: 0 };
      accountCashflow = {
        accountId: account.id,
        accountName: account.name,
        currency: account.currency,
        income: cf.income,
        expenses: cf.expenses,
        net: cf.net,
      };
    }
  }

  return {
    currency,
    dateMode: query.dateMode,
    fromDate,
    toDate,
    prevFromDate,
    prevToDate,
    summary,
    prevSummary,
    dailySpending,
    categoryBreakdown,
    topPayees,
    cashflowByMonth,
    accountCashflow,
  };
});
