/**
 * Finance reporting queries (read-only aggregations for MCP reporting tools)
 * - getBudgetProgress(userId, budgetId, month?) — category spending vs monthly target
 * - getCashflowSummary(userId, budgetId, dateFrom, dateTo) — income vs expenses by period
 * - getSpendingByPayee(userId, budgetId, dateFrom, dateTo, limit?, categoryId?) — aggregated spend per payee, optional category filter
 * - getSpendingAggregates(userId, budgetId, opts) — flexible groupBy aggregation
 * - getComparison(userId, budgetId, opts) — side-by-side period comparison with absolute and percentage delta
 * - getAccountsCashflow(userId, budgetId, dateFrom, dateTo, accountIds?) — per-account income vs spending (expenses + categorized transfers into Loan accounts) for a date range
 * - getSavingsAndDebtFlows(userId, budgetId, dateFrom, dateTo) — net transfers (in minus out) into Goal/Tracking (savings), Investment, and Loan (debt repayment) accounts for a date range
 * - getAccountFlows(userId, budgetId, dateFrom, dateTo, accountId?) — per-account opening/closing balance + inflows/outflows/net delta for a date range, with a reconciliation flag
 * - getSavingsContributions(userId, budgetId, dateFrom, dateTo) — net transfers in/out of Goal/Tracking/Investment accounts, per account (as MoneyAmount pairs: original account currency + budget-default-currency converted) + combined total, plus the same metric for the immediately preceding period of equal length
 * - getNetWorthSummary(userId, budgetId) — current net worth with account breakdown and history
 * Types: BudgetProgressResult, CashflowSummaryResult, SpendingByPayeeResult, SpendingAggregatesResult, ComparisonResult, ComparisonGroup, AccountCashflowResult, SavingsAndDebtFlowsResult, AccountFlow, AccountFlowsResult, MoneyAmount, AccountContribution, SavingsContributionsResult, NetWorthSummaryResult, AccountNetWorth (includes optional loanSummary for loan accounts)
 */
import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
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
import { hasAccessToBudget, getBudgetByIdSystem } from './budgets';
import { getLedgerBalances } from './accounts';
import { getExchangeRate } from './exchangeRates';
import { getLoanBalanceSnapshotForAccount, getLoanSummaryForAccount, type LoanSummary } from './loan-amortization';
import { currentDateString, dateToString, shiftDateStr } from '../../utils';

// ─── Budget Progress ──────────────────────────────────────────────────────────

export interface CategoryProgress {
  id: number;
  name: string;
  displayName: string;
  monthlyTarget: number | null;
  spent: number;
  remainingBudget: number | null;
  percentUsed: number | null;
}

export interface BudgetProgressResult {
  month: string;
  totalBudgeted: number;
  totalSpent: number;
  categories: CategoryProgress[];
}

export async function getBudgetProgress(
  userId: string,
  budgetId: number,
  month?: string,
): Promise<BudgetProgressResult> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const targetMonth = month ?? dateToString(new Date(), 'YYYY-MM'); // YYYY-MM
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
    const target = cat.monthlyTarget ?? null;

    // Categories excluded from the aggregate budget (e.g. loan repayment categories shown as
    // their own widget card) still get their own progress row below, just not counted here.
    if (cat.includeInSpendingBudget) {
      if (target !== null) totalBudgeted += target;
      totalSpent += spent;
    }

    const remainingBudget = target !== null ? target - spent : null;
    const percentUsed = target !== null && target > 0 ? Math.round((spent / target) * 100) : null;

    return {
      id: cat.id,
      name: cat.name,
      displayName,
      monthlyTarget: cat.monthlyTarget ?? null,
      spent,
      remainingBudget,
      percentUsed,
    };
  });

  return {
    month: targetMonth,
    totalBudgeted,
    totalSpent,
    categories: categoryProgress,
  };
}

// ─── Cashflow Summary ─────────────────────────────────────────────────────────

export interface MonthCashflow {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export interface CashflowSummaryResult {
  dateFrom: string;
  dateTo: string;
  totalIncome: number;
  totalExpenses: number;
  net: number;
  byMonth: MonthCashflow[];
}

export async function getCashflowSummary(
  userId: string,
  budgetId: number,
  dateFrom: string,
  dateTo: string,
): Promise<CashflowSummaryResult> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
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
        sql`${financeTransactions.type} in (${TransactionTypes.Expense}, ${TransactionTypes.Income})`,
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
      income: data.income,
      expenses: data.expenses,
      net: data.income - data.expenses,
    }));

  return {
    dateFrom,
    dateTo,
    totalIncome,
    totalExpenses,
    net: totalIncome - totalExpenses,
    byMonth,
  };
}

// ─── Account Cashflow ─────────────────────────────────────────────────────────

export interface AccountCashflowResult {
  income: number;
  expenses: number;
  net: number;
}

/**
 * Returns per-account income vs spending totals for a date range.
 * "Spending" includes expense transactions plus transfer transactions that are
 * categorized loan repayments (transfers into a Loan account); transfers into
 * Goal/Tracking/Investment accounts are excluded, matching the dashboard's
 * "Spending" convention. When accountIds is omitted, totals are computed for
 * every account in the budget.
 */
export async function getAccountsCashflow(
  userId: string,
  budgetId: number,
  dateFrom: string,
  dateTo: string,
  accountIds?: number[],
): Promise<Map<number, AccountCashflowResult>> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  if (accountIds && accountIds.length === 0) return new Map();

  const conditions = [
    eq(financeTransactions.budgetId, budgetId),
    eq(financeTransactions.isCorrection, false),
    gte(financeTransactions.date, dateFrom),
    lte(financeTransactions.date, dateTo),
    sql`${financeTransactions.type} in (${TransactionTypes.Income}, ${TransactionTypes.Expense}, ${TransactionTypes.Transfer})`,
  ];
  if (accountIds) {
    conditions.push(inArray(financeTransactions.accountId, accountIds));
  }

  const rows = await db
    .select({
      accountId: financeTransactions.accountId,
      type: financeTransactions.type,
      hasCategory: sql<boolean>`(${financeTransactions.categoryId} is not null)`,
      isLoanRepayment: sql<boolean>`(${financeAccounts.type} = ${AccountTypes.Loan})`,
      total: sql<string>`sum(${financeTransactions.amount})`,
    })
    .from(financeTransactions)
    .leftJoin(financeAccounts, eq(financeAccounts.id, financeTransactions.toAccountId))
    .where(and(...conditions))
    .groupBy(
      financeTransactions.accountId,
      financeTransactions.type,
      sql`(${financeTransactions.categoryId} is not null)`,
      financeAccounts.type,
    );

  const result = new Map<number, AccountCashflowResult>();
  for (const row of rows) {
    const entry = result.get(row.accountId) ?? { income: 0, expenses: 0, net: 0 };
    const amount = parseFloat(row.total ?? '0');
    if (row.type === TransactionTypes.Income) {
      entry.income += amount;
    } else if (
      row.type === TransactionTypes.Expense ||
      (row.type === TransactionTypes.Transfer && row.hasCategory && row.isLoanRepayment)
    ) {
      entry.expenses += amount;
    }
    result.set(row.accountId, entry);
  }

  for (const entry of result.values()) {
    entry.income = Math.round(entry.income * 100) / 100;
    entry.expenses = Math.round(entry.expenses * 100) / 100;
    entry.net = Math.round((entry.income - entry.expenses) * 100) / 100;
  }

  return result;
}

// ─── Savings & Debt Flows ─────────────────────────────────────────────────────

export interface SavingsAndDebtFlowsResult {
  /** Transfers into Goal or Tracking accounts during the period. */
  savings: number;
  /** Transfers into Investment accounts during the period. */
  investments: number;
  /** Transfers into Loan accounts during the period (debt repayments). */
  debtRepayment: number;
}

/**
 * Returns the net amount transferred (in the budget's default currency) into
 * Goal/Tracking accounts (savings), Investment accounts, and Loan accounts (debt
 * repayment) during a date range. "Net" means transfers out of these account types
 * (e.g. withdrawing from savings back to a bank account) reduce the total — moving
 * 30k into savings and then 10k back out nets to 20k. Credit Card repayments are
 * intentionally excluded — those are already reflected as spending via getAccountsCashflow.
 */
export async function getSavingsAndDebtFlows(
  userId: string,
  budgetId: number,
  dateFrom: string,
  dateTo: string,
): Promise<SavingsAndDebtFlowsResult> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const trackedTypes = [AccountTypes.Goal, AccountTypes.Tracking, AccountTypes.Investment, AccountTypes.Loan];

  const baseConditions = [
    eq(financeTransactions.budgetId, budgetId),
    eq(financeTransactions.type, TransactionTypes.Transfer),
    eq(financeTransactions.isCorrection, false),
    gte(financeTransactions.date, dateFrom),
    lte(financeTransactions.date, dateTo),
  ];

  // Inflows: transfers into Goal/Tracking/Investment/Loan accounts.
  const inflowRows = await db
    .select({
      accountType: financeAccounts.type,
      total: sql<string>`sum(${financeTransactions.amount} * ${financeTransactions.exchangeRate})`,
    })
    .from(financeTransactions)
    .innerJoin(financeAccounts, eq(financeAccounts.id, financeTransactions.toAccountId))
    .where(and(...baseConditions, inArray(financeAccounts.type, trackedTypes)))
    .groupBy(financeAccounts.type);

  // Outflows: transfers out of Goal/Tracking/Investment/Loan accounts (e.g. withdrawals).
  const outflowRows = await db
    .select({
      accountType: financeAccounts.type,
      total: sql<string>`sum(${financeTransactions.amount} * ${financeTransactions.exchangeRate})`,
    })
    .from(financeTransactions)
    .innerJoin(financeAccounts, eq(financeAccounts.id, financeTransactions.accountId))
    .where(and(...baseConditions, inArray(financeAccounts.type, trackedTypes)))
    .groupBy(financeAccounts.type);

  const netByType = new Map<AccountType, number>();
  for (const row of inflowRows) {
    netByType.set(row.accountType, (netByType.get(row.accountType) ?? 0) + parseFloat(row.total ?? '0'));
  }
  for (const row of outflowRows) {
    netByType.set(row.accountType, (netByType.get(row.accountType) ?? 0) - parseFloat(row.total ?? '0'));
  }

  const savings = (netByType.get(AccountTypes.Goal) ?? 0) + (netByType.get(AccountTypes.Tracking) ?? 0);
  const investments = netByType.get(AccountTypes.Investment) ?? 0;
  const debtRepayment = netByType.get(AccountTypes.Loan) ?? 0;

  return {
    savings: Math.round(savings * 100) / 100,
    investments: Math.round(investments * 100) / 100,
    debtRepayment: Math.round(debtRepayment * 100) / 100,
  };
}

// ─── Account Flows (per-account opening/closing balance + inflows/outflows) ──

export interface AccountFlow {
  accountId: number;
  accountName: string;
  accountType: AccountType;
  currency: string;
  openingBalance: number;
  closingBalance: number;
  inflows: number;
  outflows: number;
  /** closingBalance - openingBalance */
  netDelta: number;
  /**
   * True when netDelta matches (inflows - outflows) within rounding. Inflows/outflows exclude
   * correction transactions while opening/closing balances include them (balances must reflect
   * the true ledger), so a mismatch here flags a correction that occurred during the period —
   * a signal of a missing or misclassified transaction that had to be manually reconciled.
   */
  reconciles: boolean;
}

export interface AccountFlowsResult {
  dateFrom: string;
  dateTo: string;
  accounts: AccountFlow[];
}

/**
 * Per-account flow decomposition for a date range: opening balance, closing balance,
 * inflows (income + transfers in), outflows (expenses + transfers out), and net delta —
 * with a reconciliation flag that catches balance corrections made during the period.
 * When accountId is omitted, every non-archived account in the budget is included.
 */
export async function getAccountFlows(
  userId: string,
  budgetId: number,
  dateFrom: string,
  dateTo: string,
  accountId?: number,
): Promise<AccountFlowsResult> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const accounts = await db
    .select()
    .from(financeAccounts)
    .where(
      and(
        eq(financeAccounts.budgetId, budgetId),
        eq(financeAccounts.archived, false),
        ...(accountId !== undefined ? [eq(financeAccounts.id, accountId)] : []),
      ),
    );
  if (accounts.length === 0) return { dateFrom, dateTo, accounts: [] };

  const accountIds = accounts.map(a => a.id);
  const dayBeforeFrom = shiftDateStr(dateFrom, -1);

  const periodBase = [
    eq(financeTransactions.budgetId, budgetId),
    eq(financeTransactions.isCorrection, false),
    gte(financeTransactions.date, dateFrom),
    lte(financeTransactions.date, dateTo),
  ];

  // All four queries are mutually independent — none depends on another's result — so they run
  // as one batch rather than two sequential Promise.all groups.
  const [openingBalances, closingBalances, fromRows, toRows] = await Promise.all([
    getLedgerBalances(accountIds, { asOfDate: dayBeforeFrom }),
    getLedgerBalances(accountIds, { asOfDate: dateTo }),
    db
      .select({
        accountId: financeTransactions.accountId,
        type: financeTransactions.type,
        total: sql<string>`sum(${financeTransactions.amount})`,
      })
      .from(financeTransactions)
      .where(and(...periodBase, inArray(financeTransactions.accountId, accountIds)))
      .groupBy(financeTransactions.accountId, financeTransactions.type),
    db
      .select({
        accountId: financeTransactions.toAccountId,
        total: sql<string>`sum(${financeTransactions.amount} * COALESCE(${financeTransactions.toExchangeRate}, 1))`,
      })
      .from(financeTransactions)
      .where(
        and(
          ...periodBase,
          eq(financeTransactions.type, TransactionTypes.Transfer),
          inArray(financeTransactions.toAccountId, accountIds),
        ),
      )
      .groupBy(financeTransactions.toAccountId),
  ]);

  const flows = new Map<number, { inflows: number; outflows: number }>();
  for (const row of fromRows) {
    const entry = flows.get(row.accountId) ?? { inflows: 0, outflows: 0 };
    const amount = parseFloat(row.total ?? '0');
    if (row.type === TransactionTypes.Income) entry.inflows += amount;
    else entry.outflows += amount; // expense or transfer-out
    flows.set(row.accountId, entry);
  }
  for (const row of toRows) {
    if (row.accountId == null) continue;
    const entry = flows.get(row.accountId) ?? { inflows: 0, outflows: 0 };
    entry.inflows += parseFloat(row.total ?? '0');
    flows.set(row.accountId, entry);
  }

  const round = (n: number) => Math.round(n * 100) / 100;

  const result: AccountFlow[] = accounts.map(account => {
    const openingBalance = round(openingBalances.get(account.id) ?? 0);
    const closingBalance = round(closingBalances.get(account.id) ?? 0);
    const { inflows, outflows } = flows.get(account.id) ?? { inflows: 0, outflows: 0 };
    const netDelta = round(closingBalance - openingBalance);
    const reconciles = Math.abs(netDelta - round(inflows - outflows)) < 0.01;

    return {
      accountId: account.id,
      accountName: account.name,
      accountType: account.type,
      currency: account.currency,
      openingBalance,
      closingBalance,
      inflows: round(inflows),
      outflows: round(outflows),
      netDelta,
      reconciles,
    };
  });

  return { dateFrom, dateTo, accounts: result };
}

// ─── Savings Contributions ────────────────────────────────────────────────────

/** An amount paired with the currency it's denominated in — never a bare number, so callers never have to guess which currency a figure is in. */
export interface MoneyAmount {
  amount: number;
  currency: string;
}

export interface AccountContribution {
  accountId: number;
  accountName: string;
  accountType: AccountType;
  /** Transfers in minus transfers out for the period, in the account's own currency. */
  original: MoneyAmount;
  /** Same amount converted to the budget's default currency — what makes accounts of different currencies addable. */
  converted: MoneyAmount;
}

export interface SavingsContributionsResult {
  dateFrom: string;
  dateTo: string;
  /** Always in the budget's default currency — the sum of every account's `converted` amount. */
  totalNetContribution: MoneyAmount;
  accounts: AccountContribution[];
  previousPeriod: {
    dateFrom: string;
    dateTo: string;
    totalNetContribution: MoneyAmount;
  };
}

/** Account types tracked as "savings/investment" for the net-contribution headline. Loan repayments are a separate concern (debt paydown), not savings. */
const SAVINGS_TRACKED_TYPES: AccountType[] = [AccountTypes.Goal, AccountTypes.Tracking, AccountTypes.Investment];

async function getSavingsContributionsForRange(
  budgetId: number,
  dateFrom: string,
  dateTo: string,
  defaultCurrency: string,
): Promise<{ total: MoneyAmount; accounts: AccountContribution[] }> {
  const baseConditions = [
    eq(financeTransactions.budgetId, budgetId),
    eq(financeTransactions.type, TransactionTypes.Transfer),
    eq(financeTransactions.isCorrection, false),
    gte(financeTransactions.date, dateFrom),
    lte(financeTransactions.date, dateTo),
  ];

  const selectCols = {
    accountId: financeAccounts.id,
    name: financeAccounts.name,
    type: financeAccounts.type,
    currency: financeAccounts.currency,
    // Raw, in the account's own currency.
    totalOriginal: sql<string>`sum(${financeTransactions.amount})`,
    // exchangeRate is "source currency -> budget default currency", so this is already converted.
    totalConverted: sql<string>`sum(${financeTransactions.amount} * ${financeTransactions.exchangeRate})`,
  };

  const [inflowRows, outflowRows] = await Promise.all([
    db
      .select(selectCols)
      .from(financeTransactions)
      .innerJoin(financeAccounts, eq(financeAccounts.id, financeTransactions.toAccountId))
      .where(and(...baseConditions, inArray(financeAccounts.type, SAVINGS_TRACKED_TYPES)))
      .groupBy(financeAccounts.id, financeAccounts.name, financeAccounts.type, financeAccounts.currency),
    db
      .select(selectCols)
      .from(financeTransactions)
      .innerJoin(financeAccounts, eq(financeAccounts.id, financeTransactions.accountId))
      .where(and(...baseConditions, inArray(financeAccounts.type, SAVINGS_TRACKED_TYPES)))
      .groupBy(financeAccounts.id, financeAccounts.name, financeAccounts.type, financeAccounts.currency),
  ]);

  interface RunningContribution {
    accountId: number;
    accountName: string;
    accountType: AccountType;
    currency: string;
    original: number;
    converted: number;
  }

  const byAccount = new Map<number, RunningContribution>();
  const apply = (row: (typeof inflowRows)[number], sign: 1 | -1) => {
    const original = parseFloat(row.totalOriginal ?? '0') * sign;
    const converted = parseFloat(row.totalConverted ?? '0') * sign;
    const existing = byAccount.get(row.accountId);
    if (existing) {
      existing.original += original;
      existing.converted += converted;
    } else {
      byAccount.set(row.accountId, {
        accountId: row.accountId,
        accountName: row.name,
        accountType: row.type,
        currency: row.currency,
        original,
        converted,
      });
    }
  };
  for (const row of inflowRows) apply(row, 1);
  for (const row of outflowRows) apply(row, -1);

  const round = (n: number) => Math.round(n * 100) / 100;

  const accounts: AccountContribution[] = Array.from(byAccount.values())
    .map(a => ({
      accountId: a.accountId,
      accountName: a.accountName,
      accountType: a.accountType,
      original: { amount: round(a.original), currency: a.currency },
      converted: { amount: round(a.converted), currency: defaultCurrency },
    }))
    .sort((a, b) => b.converted.amount - a.converted.amount);

  return {
    total: { amount: round(accounts.reduce((s, a) => s + a.converted.amount, 0)), currency: defaultCurrency },
    accounts,
  };
}

/**
 * Net amount transferred into Goal/Tracking/Investment accounts during a date range ("did I
 * actually save something this period?"), per account plus a combined total, alongside the same
 * metric for the immediately preceding period of equal length for a quick delta. Each account's
 * contribution is reported both in its own currency and converted to the budget's default
 * currency — never only the converted figure, so a caller can always see the real, unconverted
 * amount too.
 */
export async function getSavingsContributions(
  userId: string,
  budgetId: number,
  dateFrom: string,
  dateTo: string,
): Promise<SavingsContributionsResult> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const budget = await getBudgetByIdSystem(budgetId);
  if (!budget) throw new Error('Budget not found');

  const periodDays = Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000) + 1;
  const prevDateTo = shiftDateStr(dateFrom, -1);
  const prevDateFrom = shiftDateStr(dateFrom, -periodDays);

  const [current, previous] = await Promise.all([
    getSavingsContributionsForRange(budgetId, dateFrom, dateTo, budget.defaultCurrency),
    getSavingsContributionsForRange(budgetId, prevDateFrom, prevDateTo, budget.defaultCurrency),
  ]);

  return {
    dateFrom,
    dateTo,
    totalNetContribution: current.total,
    accounts: current.accounts,
    previousPeriod: { dateFrom: prevDateFrom, dateTo: prevDateTo, totalNetContribution: previous.total },
  };
}

// ─── Spending by Payee ────────────────────────────────────────────────────────

export interface PayeeSpending {
  payeeId: number;
  name: string;
  transactionCount: number;
  totalSpent: number;
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
  categoryId?: number,
): Promise<SpendingByPayeeResult> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const conditions = [
    eq(financeTransactions.budgetId, budgetId),
    eq(financeTransactions.type, TransactionTypes.Expense),
    eq(financeTransactions.isCorrection, false),
    gte(financeTransactions.date, dateFrom),
    lte(financeTransactions.date, dateTo),
    sql`${financeTransactions.payeeId} is not null`,
  ];

  if (categoryId !== undefined) {
    conditions.push(eq(financeTransactions.categoryId, categoryId));
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
    .where(and(...conditions))
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
      totalSpent: parseFloat(r.total ?? '0'),
    })),
  };
}

// ─── Spending Aggregates ──────────────────────────────────────────────────────

export type AggregateGroupBy = 'category' | 'payee' | 'account' | 'month' | 'type';

export interface AggregateGroup {
  key: string;
  id?: number;
  transactionCount: number;
  total: number;
  average: number;
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
  if (!(await hasAccessToBudget(userId, budgetId))) {
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
        total,
        average: r.count > 0 ? total / r.count : 0,
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
        total,
        average: r.count > 0 ? total / r.count : 0,
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
        total,
        average: r.count > 0 ? total / r.count : 0,
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
        total,
        average: r.count > 0 ? total / r.count : 0,
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
        total,
        average: r.count > 0 ? total / r.count : 0,
      };
    });
  }

  return { dateFrom: opts.dateFrom, dateTo: opts.dateTo, groupBy: opts.groupBy, groups };
}

// ─── Period Comparison ────────────────────────────────────────────────────────

export type ComparisonGroupBy = 'category' | 'payee' | 'account' | 'month';

export interface ComparisonGroup {
  key: string;
  id?: number;
  period1: { transactionCount: number; total: number; average: number };
  period2: { transactionCount: number; total: number; average: number };
  /** Absolute change: period2.total - period1.total */
  absoluteDelta: number;
  /** Percentage change relative to period1, null when period1.total is 0 */
  percentDelta: number | null;
}

export interface ComparisonOpts {
  period1: { dateFrom: string; dateTo: string };
  period2: { dateFrom: string; dateTo: string };
  groupBy: ComparisonGroupBy;
  accountId?: number;
  categoryId?: number;
  type?: TransactionType;
}

export interface ComparisonResult {
  period1: { dateFrom: string; dateTo: string };
  period2: { dateFrom: string; dateTo: string };
  groupBy: string;
  groups: ComparisonGroup[];
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export async function getComparison(userId: string, budgetId: number, opts: ComparisonOpts): Promise<ComparisonResult> {
  const [r1, r2] = await Promise.all([
    getSpendingAggregates(userId, budgetId, { ...opts, ...opts.period1 }),
    getSpendingAggregates(userId, budgetId, { ...opts, ...opts.period2 }),
  ]);

  // For month groupBy, strip the year so "2023-01" and "2024-01" both match on "01".
  // This lets YoY and any cross-year comparisons align by calendar month.
  const isMonthGroupBy = opts.groupBy === 'month';
  const toMatchKey = (key: string) => (isMonthGroupBy ? key.slice(5) : key);
  const toDisplayKey = (key: string) => {
    if (!isMonthGroupBy) return key;
    const month = parseInt(key.slice(5), 10);
    return MONTH_NAMES[month - 1] ?? key;
  };
  const toMonthId = (key: string) => (isMonthGroupBy ? parseInt(key.slice(5), 10) : undefined);

  // Index both periods by match key for O(1) lookup
  const p1ByKey = new Map<string, AggregateGroup>();
  for (const g of r1.groups) p1ByKey.set(toMatchKey(g.key), g);
  const p2ByKey = new Map<string, AggregateGroup>();
  for (const g of r2.groups) p2ByKey.set(toMatchKey(g.key), g);

  // Union of all match keys from both periods
  const allKeys = new Map<string, { id?: number; displayKey: string }>();
  for (const g of r1.groups) {
    const mk = toMatchKey(g.key);
    allKeys.set(mk, { id: isMonthGroupBy ? toMonthId(g.key) : g.id, displayKey: toDisplayKey(g.key) });
  }
  for (const g of r2.groups) {
    const mk = toMatchKey(g.key);
    if (!allKeys.has(mk))
      allKeys.set(mk, { id: isMonthGroupBy ? toMonthId(g.key) : g.id, displayKey: toDisplayKey(g.key) });
  }

  const groups: ComparisonGroup[] = [];
  for (const [mk, meta] of allKeys) {
    const p1 = p1ByKey.get(mk) ?? { transactionCount: 0, total: 0, average: 0 };
    const p2 = p2ByKey.get(mk) ?? { transactionCount: 0, total: 0, average: 0 };
    const absoluteDelta = p2.total - p1.total;
    const percentDelta = p1.total !== 0 ? Math.round((absoluteDelta / p1.total) * 10000) / 100 : null;
    groups.push({
      key: meta.displayKey,
      ...(meta.id !== undefined ? { id: meta.id } : {}),
      period1: { transactionCount: p1.transactionCount, total: p1.total, average: p1.average },
      period2: { transactionCount: p2.transactionCount, total: p2.total, average: p2.average },
      absoluteDelta,
      percentDelta,
    });
  }

  // Month groupBy: sort chronologically; all others: sort by period2 total descending
  if (isMonthGroupBy) {
    groups.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  } else {
    groups.sort((a, b) => b.period2.total - a.period2.total);
  }

  return {
    period1: opts.period1,
    period2: opts.period2,
    groupBy: opts.groupBy,
    groups,
  };
}

// ─── Net Worth Summary ────────────────────────────────────────────────────────

export interface AccountNetWorth {
  id: number;
  name: string;
  balance: number;
  currency: string;
  balanceInDefaultCurrency: number;
  loanSummary?: LoanSummary;
}

export interface NetWorthByType {
  total: number;
  accounts: AccountNetWorth[];
}

export interface NetWorthHistoryEntry {
  month: string;
  netWorth: number;
}

export interface NetWorthSummaryResult {
  currency: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  byType: Partial<Record<AccountType, NetWorthByType>>;
  history: NetWorthHistoryEntry[];
}

const LIABILITY_TYPES: AccountType[] = [AccountTypes.Loan, AccountTypes.CreditCard, AccountTypes.BorrowedLent];

export async function getNetWorthSummary(userId: string, budgetId: number): Promise<NetWorthSummaryResult> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  return computeNetWorthSummary(userId, budgetId);
}

/**
 * Does the actual net worth computation with no membership check of its own — callers that have
 * already established access (getNetWorthSummary) or a legitimate system-level acting userId
 * (snapshotNetWorth) call this directly instead of re-verifying access on every nested call.
 */
async function computeNetWorthSummary(userId: string, budgetId: number): Promise<NetWorthSummaryResult> {
  const budget = await getBudgetByIdSystem(budgetId);
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
    const { balance: accountBalance } = acct;
    let balance = accountBalance;
    let loanSummary: LoanSummary | undefined;
    if (acct.type === AccountTypes.Loan) {
      const [loanSnapshot, summary] = await Promise.all([
        getLoanBalanceSnapshotForAccount(userId, budgetId, acct, { asOfDate: today }),
        getLoanSummaryForAccount(userId, budgetId, acct, { asOfDate: today }),
      ]);
      if (loanSnapshot) {
        balance = loanSnapshot.balance;
      }
      if (summary) {
        loanSummary = summary;
      }
    }
    const rate = await getExchangeRate(acct.currency, budget.defaultCurrency, today);
    const balanceDefault = balance * rate;

    const entry: AccountNetWorth = {
      id: acct.id,
      name: acct.name,
      balance,
      currency: acct.currency,
      balanceInDefaultCurrency: balanceDefault,
      ...(loanSummary ? { loanSummary } : {}),
    };

    if (!byType[acct.type]) {
      byType[acct.type] = { total: 0, accounts: [] };
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
    const total = group.accounts.reduce((sum, a) => sum + a.balanceInDefaultCurrency, 0);
    group.total = total;
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
    netWorth,
    totalAssets,
    totalLiabilities,
    byType,
    history,
  };
}

// ─── Net Worth Snapshot (writer) ──────────────────────────────────────────────

/**
 * Computes the current net worth summary and persists it as that month's snapshot row
 * (upsert on the (budgetId, month) unique index — safe to re-run within the same month).
 * userId must be a valid member of budgetId (e.g. from getAllBudgetsForSystem's ownerUserId) —
 * still required because the underlying loan calculations query transactions on the user's
 * behalf, but this skips the redundant membership re-check getNetWorthSummary would otherwise
 * perform, since the worker has already established a legitimate acting userId for this budget.
 * No further auth required — intended for use by the worker's monthly snapshot job only.
 * month defaults to the current YYYY-MM.
 */
export async function snapshotNetWorth(userId: string, budgetId: number, month?: string): Promise<void> {
  const summary = await computeNetWorthSummary(userId, budgetId);
  const targetMonth = month ?? dateToString(new Date(), 'YYYY-MM');

  await db
    .insert(financeNetWorthSnapshots)
    .values({
      budgetId,
      month: targetMonth,
      totalAssets: summary.totalAssets,
      totalLiabilities: summary.totalLiabilities,
      netWorth: summary.netWorth,
      breakdown: summary.byType,
    })
    .onConflictDoUpdate({
      target: [financeNetWorthSnapshots.budgetId, financeNetWorthSnapshots.month],
      set: {
        totalAssets: summary.totalAssets,
        totalLiabilities: summary.totalLiabilities,
        netWorth: summary.netWorth,
        breakdown: summary.byType,
      },
    });
}
