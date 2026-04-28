/**
 * Finance reporting queries (read-only aggregations for MCP reporting tools)
 * - getBudgetProgress(userId, budgetId, month?) — category spending vs monthly target
 * - getCashflowSummary(userId, budgetId, dateFrom, dateTo) — income vs expenses by period
 * - getSpendingByPayee(userId, budgetId, dateFrom, dateTo, limit?) — aggregated spend per payee
 * - getSpendingAggregates(userId, budgetId, opts) — flexible groupBy aggregation
 * - getNetWorthSummary(userId, budgetId) — current net worth with account breakdown and history
 * Types: BudgetProgressResult, CashflowSummaryResult, SpendingByPayeeResult, SpendingAggregatesResult, NetWorthSummaryResult
 */
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  financeAccounts,
  financeCategories,
  financeGroups,
  financeNetWorthSnapshots,
  financePayees,
  financeTransactions,
} from '../../db/schema/finances';
import type { AccountType, TransactionType } from '../../constants/finances';
import { AccountTypes, TransactionTypes } from '../../constants/finances';
import { verifyBudgetAccess, getBudgetById } from './budgets';
import { getCurrencyRate } from './currency';
import { currentDateString } from '../../utils';

// ─── Budget Progress ──────────────────────────────────────────────────────────

export interface CategoryProgress {
  id: number;
  name: string;
  displayName: string;
  monthlyTarget: string | null;
  spent: string;
  remainingBudget: string | null;
  percentUsed: number | null;
}

export interface BudgetProgressResult {
  month: string;
  totalBudgeted: string;
  totalSpent: string;
  categories: CategoryProgress[];
}

export async function getBudgetProgress(
  userId: string,
  budgetId: number,
  month?: string,
): Promise<BudgetProgressResult> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const targetMonth = month ?? currentDateString().slice(0, 7); // YYYY-MM
  const dateFrom = `${targetMonth}-01`;
  // Last day of month: first day of next month minus one day
  const [year, mon] = targetMonth.split('-').map(Number);
  const lastDay = new Date(year!, mon!, 0).getDate();
  const dateTo = `${targetMonth}-${String(lastDay).padStart(2, '0')}`;

  // Get groups for display names
  const groups = await db
    .select({ id: financeGroups.id, name: financeGroups.name })
    .from(financeGroups)
    .where(eq(financeGroups.budgetId, budgetId));
  const groupMap = new Map(groups.map(g => [g.id, g.name]));

  // Get all categories
  const categories = await db.select().from(financeCategories).where(eq(financeCategories.budgetId, budgetId));

  // Aggregate expenses by category for the month (exclude corrections)
  const spendingRows = await db
    .select({
      categoryId: financeTransactions.categoryId,
      total: sql<string>`sum(${financeTransactions.amount})`,
    })
    .from(financeTransactions)
    .where(
      and(
        eq(financeTransactions.budgetId, budgetId),
        eq(financeTransactions.type, TransactionTypes.Expense),
        eq(financeTransactions.isCorrection, false),
        gte(financeTransactions.date, dateFrom),
        lte(financeTransactions.date, dateTo),
      ),
    )
    .groupBy(financeTransactions.categoryId);

  const spendMap = new Map<number | null, number>();
  for (const row of spendingRows) {
    spendMap.set(row.categoryId, parseFloat(row.total ?? '0'));
  }

  let totalBudgeted = 0;
  let totalSpent = 0;

  const categoryProgress: CategoryProgress[] = categories.map(cat => {
    const groupName = cat.groupId ? groupMap.get(cat.groupId) : null;
    const displayName = groupName ? `${groupName} > ${cat.name}` : cat.name;
    const spent = spendMap.get(cat.id) ?? 0;
    const target = cat.monthlyTarget ? parseFloat(cat.monthlyTarget) : null;

    if (target !== null) totalBudgeted += target;
    totalSpent += spent;

    const remainingBudget = target !== null ? String(target - spent) : null;
    const percentUsed = target !== null && target > 0 ? Math.round((spent / target) * 100) : null;

    return {
      id: cat.id,
      name: cat.name,
      displayName,
      monthlyTarget: cat.monthlyTarget,
      spent: String(spent),
      remainingBudget,
      percentUsed,
    };
  });

  return {
    month: targetMonth,
    totalBudgeted: String(totalBudgeted),
    totalSpent: String(totalSpent),
    categories: categoryProgress,
  };
}

// ─── Cashflow Summary ─────────────────────────────────────────────────────────

export interface MonthCashflow {
  month: string;
  income: string;
  expenses: string;
  net: string;
}

export interface CashflowSummaryResult {
  dateFrom: string;
  dateTo: string;
  totalIncome: string;
  totalExpenses: string;
  net: string;
  byMonth: MonthCashflow[];
}

export async function getCashflowSummary(
  userId: string,
  budgetId: number,
  dateFrom: string,
  dateTo: string,
): Promise<CashflowSummaryResult> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const rows = await db
    .select({
      type: financeTransactions.type,
      month: sql<string>`to_char(${financeTransactions.date}::date, 'YYYY-MM')`,
      total: sql<string>`sum(${financeTransactions.amount})`,
    })
    .from(financeTransactions)
    .where(
      and(
        eq(financeTransactions.budgetId, budgetId),
        eq(financeTransactions.isCorrection, false),
        gte(financeTransactions.date, dateFrom),
        lte(financeTransactions.date, dateTo),
        sql`${financeTransactions.type} in ('expense', 'income')`,
      ),
    )
    .groupBy(financeTransactions.type, sql`to_char(${financeTransactions.date}::date, 'YYYY-MM')`);

  // Build month map
  type MonthData = { income: number; expenses: number };
  const monthMap = new Map<string, MonthData>();

  let totalIncome = 0;
  let totalExpenses = 0;

  for (const row of rows) {
    const m = row.month;
    if (!monthMap.has(m)) monthMap.set(m, { income: 0, expenses: 0 });
    const entry = monthMap.get(m)!;
    const val = parseFloat(row.total ?? '0');

    if (row.type === TransactionTypes.Income) {
      entry.income += val;
      totalIncome += val;
    } else if (row.type === TransactionTypes.Expense) {
      entry.expenses += val;
      totalExpenses += val;
    }
  }

  const byMonth: MonthCashflow[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      income: String(data.income),
      expenses: String(data.expenses),
      net: String(data.income - data.expenses),
    }));

  return {
    dateFrom,
    dateTo,
    totalIncome: String(totalIncome),
    totalExpenses: String(totalExpenses),
    net: String(totalIncome - totalExpenses),
    byMonth,
  };
}

// ─── Spending by Payee ────────────────────────────────────────────────────────

export interface PayeeSpending {
  payeeId: number;
  name: string;
  transactionCount: number;
  totalSpent: string;
}

export interface SpendingByPayeeResult {
  dateFrom: string;
  dateTo: string;
  payees: PayeeSpending[];
}

export async function getSpendingByPayee(
  userId: string,
  budgetId: number,
  dateFrom: string,
  dateTo: string,
  limit = 20,
): Promise<SpendingByPayeeResult> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const rows = await db
    .select({
      payeeId: financeTransactions.payeeId,
      name: financePayees.name,
      count: sql<number>`count(*)::int`,
      total: sql<string>`sum(${financeTransactions.amount})`,
    })
    .from(financeTransactions)
    .leftJoin(financePayees, eq(financePayees.id, financeTransactions.payeeId))
    .where(
      and(
        eq(financeTransactions.budgetId, budgetId),
        eq(financeTransactions.type, TransactionTypes.Expense),
        eq(financeTransactions.isCorrection, false),
        gte(financeTransactions.date, dateFrom),
        lte(financeTransactions.date, dateTo),
        sql`${financeTransactions.payeeId} is not null`,
      ),
    )
    .groupBy(financeTransactions.payeeId, financePayees.name)
    .orderBy(sql`sum(${financeTransactions.amount}) desc`)
    .limit(limit);

  return {
    dateFrom,
    dateTo,
    payees: rows.map(r => ({
      payeeId: r.payeeId!,
      name: r.name ?? 'Unknown',
      transactionCount: r.count,
      totalSpent: r.total ?? '0',
    })),
  };
}

// ─── Spending Aggregates ──────────────────────────────────────────────────────

export type AggregateGroupBy = 'category' | 'payee' | 'account' | 'month' | 'type';

export interface AggregateGroup {
  key: string;
  id?: number;
  transactionCount: number;
  total: string;
  average: string;
}

export interface SpendingAggregatesOpts {
  dateFrom: string;
  dateTo: string;
  groupBy: AggregateGroupBy;
  accountId?: number;
  categoryId?: number;
  type?: TransactionType;
}

export interface SpendingAggregatesResult {
  dateFrom: string;
  dateTo: string;
  groupBy: string;
  groups: AggregateGroup[];
}

export async function getSpendingAggregates(
  userId: string,
  budgetId: number,
  opts: SpendingAggregatesOpts,
): Promise<SpendingAggregatesResult> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const conditions = [
    eq(financeTransactions.budgetId, budgetId),
    eq(financeTransactions.isCorrection, false),
    gte(financeTransactions.date, opts.dateFrom),
    lte(financeTransactions.date, opts.dateTo),
  ];

  if (opts.accountId !== undefined) {
    conditions.push(eq(financeTransactions.accountId, opts.accountId));
  }
  if (opts.categoryId !== undefined) {
    conditions.push(eq(financeTransactions.categoryId, opts.categoryId));
  }
  if (opts.type !== undefined) {
    conditions.push(eq(financeTransactions.type, opts.type));
  }

  let groups: AggregateGroup[];

  if (opts.groupBy === 'category') {
    const rows = await db
      .select({
        id: financeTransactions.categoryId,
        name: financeCategories.name,
        count: sql<number>`count(*)::int`,
        total: sql<string>`sum(${financeTransactions.amount})`,
      })
      .from(financeTransactions)
      .leftJoin(financeCategories, eq(financeCategories.id, financeTransactions.categoryId))
      .where(and(...conditions))
      .groupBy(financeTransactions.categoryId, financeCategories.name)
      .orderBy(sql`sum(${financeTransactions.amount}) desc`);

    groups = rows.map(r => {
      const total = parseFloat(r.total ?? '0');
      return {
        key: r.name ?? '(uncategorized)',
        id: r.id ?? undefined,
        transactionCount: r.count,
        total: String(total),
        average: r.count > 0 ? String(total / r.count) : '0',
      };
    });
  } else if (opts.groupBy === 'payee') {
    const rows = await db
      .select({
        id: financeTransactions.payeeId,
        name: financePayees.name,
        count: sql<number>`count(*)::int`,
        total: sql<string>`sum(${financeTransactions.amount})`,
      })
      .from(financeTransactions)
      .leftJoin(financePayees, eq(financePayees.id, financeTransactions.payeeId))
      .where(and(...conditions))
      .groupBy(financeTransactions.payeeId, financePayees.name)
      .orderBy(sql`sum(${financeTransactions.amount}) desc`);

    groups = rows.map(r => {
      const total = parseFloat(r.total ?? '0');
      return {
        key: r.name ?? '(no payee)',
        id: r.id ?? undefined,
        transactionCount: r.count,
        total: String(total),
        average: r.count > 0 ? String(total / r.count) : '0',
      };
    });
  } else if (opts.groupBy === 'account') {
    const rows = await db
      .select({
        id: financeTransactions.accountId,
        name: financeAccounts.name,
        count: sql<number>`count(*)::int`,
        total: sql<string>`sum(${financeTransactions.amount})`,
      })
      .from(financeTransactions)
      .leftJoin(financeAccounts, eq(financeAccounts.id, financeTransactions.accountId))
      .where(and(...conditions))
      .groupBy(financeTransactions.accountId, financeAccounts.name)
      .orderBy(sql`sum(${financeTransactions.amount}) desc`);

    groups = rows.map(r => {
      const total = parseFloat(r.total ?? '0');
      return {
        key: r.name ?? 'Unknown',
        id: r.id,
        transactionCount: r.count,
        total: String(total),
        average: r.count > 0 ? String(total / r.count) : '0',
      };
    });
  } else if (opts.groupBy === 'month') {
    const rows = await db
      .select({
        month: sql<string>`to_char(${financeTransactions.date}::date, 'YYYY-MM')`,
        count: sql<number>`count(*)::int`,
        total: sql<string>`sum(${financeTransactions.amount})`,
      })
      .from(financeTransactions)
      .where(and(...conditions))
      .groupBy(sql`to_char(${financeTransactions.date}::date, 'YYYY-MM')`)
      .orderBy(sql`to_char(${financeTransactions.date}::date, 'YYYY-MM')`);

    groups = rows.map(r => {
      const total = parseFloat(r.total ?? '0');
      return {
        key: r.month,
        transactionCount: r.count,
        total: String(total),
        average: r.count > 0 ? String(total / r.count) : '0',
      };
    });
  } else {
    // groupBy === 'type'
    const rows = await db
      .select({
        type: financeTransactions.type,
        count: sql<number>`count(*)::int`,
        total: sql<string>`sum(${financeTransactions.amount})`,
      })
      .from(financeTransactions)
      .where(and(...conditions))
      .groupBy(financeTransactions.type)
      .orderBy(sql`sum(${financeTransactions.amount}) desc`);

    groups = rows.map(r => {
      const total = parseFloat(r.total ?? '0');
      return {
        key: r.type,
        transactionCount: r.count,
        total: String(total),
        average: r.count > 0 ? String(total / r.count) : '0',
      };
    });
  }

  return { dateFrom: opts.dateFrom, dateTo: opts.dateTo, groupBy: opts.groupBy, groups };
}

// ─── Net Worth Summary ────────────────────────────────────────────────────────

export interface AccountNetWorth {
  id: number;
  name: string;
  balance: string;
  currency: string;
  balanceInDefaultCurrency: string;
}

export interface NetWorthByType {
  total: string;
  accounts: AccountNetWorth[];
}

export interface NetWorthHistoryEntry {
  month: string;
  netWorth: string;
}

export interface NetWorthSummaryResult {
  currency: string;
  netWorth: string;
  totalAssets: string;
  totalLiabilities: string;
  byType: Partial<Record<AccountType, NetWorthByType>>;
  history: NetWorthHistoryEntry[];
}

const LIABILITY_TYPES: AccountType[] = [AccountTypes.Loan, AccountTypes.CreditCard, AccountTypes.BorrowedLent];

export async function getNetWorthSummary(userId: string, budgetId: number): Promise<NetWorthSummaryResult> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const budget = await getBudgetById(userId, budgetId);
  if (!budget) throw new Error('Budget not found');

  const accounts = await db
    .select()
    .from(financeAccounts)
    .where(and(eq(financeAccounts.budgetId, budgetId), eq(financeAccounts.archived, false)));

  const today = currentDateString();

  // Build byType map with currency conversion
  const byType: Partial<Record<AccountType, NetWorthByType>> = {};
  let totalAssets = 0;
  let totalLiabilities = 0;

  for (const acct of accounts) {
    const balance = parseFloat(acct.balance);
    const rate = await getCurrencyRate(acct.currency, budget.defaultCurrency, today);
    const balanceDefault = balance * rate;

    const entry: AccountNetWorth = {
      id: acct.id,
      name: acct.name,
      balance: acct.balance,
      currency: acct.currency,
      balanceInDefaultCurrency: String(balanceDefault),
    };

    if (!byType[acct.type]) {
      byType[acct.type] = { total: '0', accounts: [] };
    }
    byType[acct.type]!.accounts.push(entry);

    const isLiability = LIABILITY_TYPES.includes(acct.type as AccountType);
    if (isLiability) {
      totalLiabilities += Math.abs(balanceDefault);
    } else {
      totalAssets += balanceDefault;
    }
  }

  // Compute per-type totals
  for (const type of Object.keys(byType) as AccountType[]) {
    const group = byType[type]!;
    const total = group.accounts.reduce((sum, a) => sum + parseFloat(a.balanceInDefaultCurrency), 0);
    group.total = String(total);
  }

  const netWorth = totalAssets - totalLiabilities;

  // Fetch last 12 monthly snapshots
  const snapshots = await db
    .select({ month: financeNetWorthSnapshots.month, netWorth: financeNetWorthSnapshots.netWorth })
    .from(financeNetWorthSnapshots)
    .where(eq(financeNetWorthSnapshots.budgetId, budgetId))
    .orderBy(sql`${financeNetWorthSnapshots.month} desc`)
    .limit(12);

  const history: NetWorthHistoryEntry[] = snapshots.reverse().map(s => ({ month: s.month, netWorth: s.netWorth }));

  return {
    currency: budget.defaultCurrency,
    netWorth: String(netWorth),
    totalAssets: String(totalAssets),
    totalLiabilities: String(totalLiabilities),
    byType,
    history,
  };
}
