/**
 * Monthly & yearly finance report assembly — composes existing reporting/service building
 * blocks (reporting.ts, accounts.ts, loan-amortization.ts, portfolio.ts) into the two standing
 * reports. No new data-access logic lives here beyond gluing those results together; see
 * reporting.ts for the underlying aggregations (including the two report-specific gap queries,
 * getAccountFlows and getSavingsContributions).
 * - getMonthlyFinanceReport(userId, budgetId, month?) — MonthlyFinanceReport for one YYYY-MM month (defaults to last completed month)
 * - getYearlyFinanceReport(userId, budgetId, year?) — YearlyFinanceReport for one calendar year (defaults to last completed year)
 * Types: CategorySpike, LoanProgress, GoalProgress, MonthlyFinanceReport, LoanPayoffProgress, IbkrDcaProgress, YearlyFinanceReport
 */
import { AccountTypes } from '../../constants/finances';
import { getAccountDetails, type FinanceAccount } from '../../types';
import { currentDateString, dateToString, getLastMonthStart, monthToDateRange, shiftDateStr } from '../../utils';
import { hasAccessToBudget, getBudgetById } from './budgets';
import { getAccounts } from './accounts';
import {
  getCashflowSummary,
  getAccountFlows,
  getSavingsContributions,
  getBudgetProgress,
  getSpendingAggregates,
  getSpendingByPayee,
  getComparison,
  getNetWorthSummary,
  type CashflowSummaryResult,
  type AccountFlowsResult,
  type SavingsContributionsResult,
  type BudgetProgressResult,
  type NetWorthHistoryEntry,
  type ComparisonResult,
} from './reporting';
import { calculateLoanAmortizationSummary } from './loan-amortization';
import { getPortfolio, getSupplies } from './portfolio';

const SPIKE_THRESHOLD_PCT = 40;
const TRAILING_WINDOW_DAYS = 90;

// ─── Monthly Report ────────────────────────────────────────────────────────────

export interface CategorySpike {
  categoryId: number | undefined;
  categoryName: string;
  currentSpend: number;
  trailingAvg: number;
  percentChange: number;
}

export interface LoanProgress {
  accountId: number;
  accountName: string;
  currency: string;
  remainingBalance: number;
  paidDownThisPeriod: number;
}

export interface GoalProgress {
  accountId: number;
  accountName: string;
  currency: string;
  balance: number;
  targetAmount: number | null;
  percentComplete: number | null;
  contributionThisPeriod: number;
}

export interface MonthlyFinanceReport {
  month: string; // YYYY-MM
  dateFrom: string;
  dateTo: string;
  cashflow: CashflowSummaryResult;
  accountFlows: AccountFlowsResult;
  savingsContributions: SavingsContributionsResult;
  budgetProgress: BudgetProgressResult;
  insights: {
    /** Categories that moved more than the threshold vs their trailing 3-month average. */
    categorySpikes: CategorySpike[];
    /** Payees with expense transactions this month that had none in the trailing 3 months. */
    newPayees: { payeeId: number; name: string; totalSpent: number }[];
    /** Accounts flagged by getAccountFlows as not reconciling — a data-quality signal. */
    dataQualityFlags: { accountId: number; accountName: string }[];
    goals: GoalProgress[];
    loans: LoanProgress[];
  };
}

async function computeCategorySpikes(
  userId: string,
  budgetId: number,
  dateFrom: string,
  dateTo: string,
): Promise<CategorySpike[]> {
  const trailingTo = shiftDateStr(dateFrom, -1);
  const trailingFrom = shiftDateStr(dateFrom, -TRAILING_WINDOW_DAYS);

  const [current, trailing] = await Promise.all([
    getSpendingAggregates(userId, budgetId, { dateFrom, dateTo, groupBy: 'category', type: 'expense' }),
    getSpendingAggregates(userId, budgetId, {
      dateFrom: trailingFrom,
      dateTo: trailingTo,
      groupBy: 'category',
      type: 'expense',
    }),
  ]);

  const trailingById = new Map(trailing.groups.filter(g => g.id !== undefined).map(g => [g.id, g.total / 3]));

  const spikes: CategorySpike[] = [];
  for (const group of current.groups) {
    if (group.id === undefined) continue;
    const trailingAvg = trailingById.get(group.id) ?? 0;
    if (trailingAvg <= 0) continue;
    const percentChange = Math.round(((group.total - trailingAvg) / trailingAvg) * 10000) / 100;
    if (Math.abs(percentChange) >= SPIKE_THRESHOLD_PCT) {
      spikes.push({
        categoryId: group.id,
        categoryName: group.key,
        currentSpend: group.total,
        trailingAvg,
        percentChange,
      });
    }
  }
  return spikes.sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));
}

async function computeNewPayees(
  userId: string,
  budgetId: number,
  dateFrom: string,
  dateTo: string,
): Promise<{ payeeId: number; name: string; totalSpent: number }[]> {
  const trailingTo = shiftDateStr(dateFrom, -1);
  const trailingFrom = shiftDateStr(dateFrom, -TRAILING_WINDOW_DAYS);

  const [current, trailing] = await Promise.all([
    getSpendingByPayee(userId, budgetId, dateFrom, dateTo, 500),
    getSpendingByPayee(userId, budgetId, trailingFrom, trailingTo, 500),
  ]);

  const seenBefore = new Set(trailing.payees.map(p => p.payeeId));
  return current.payees
    .filter(p => !seenBefore.has(p.payeeId))
    .map(p => ({ payeeId: p.payeeId, name: p.name, totalSpent: p.totalSpent }));
}

interface LoanPayoffFigures {
  accountId: number;
  accountName: string;
  currency: string;
  remainingBalance: number;
  paidDown: number;
}

/**
 * Loan payoff progress for a date range — shared by the monthly and yearly reports, which only
 * differ in what they call the "paid down" field. Interest-bearing loans use the pure
 * schedule-derived calculateLoanAmortizationSummary (loan-amortization.ts's documented single
 * source of truth); zero-interest loans reuse the already-computed getAccountFlows ledger
 * balance, since every payment there is pure principal.
 */
function computeLoanPayoffFigures(
  loans: FinanceAccount[],
  accountFlows: AccountFlowsResult,
  dateFrom: string,
  dateTo: string,
): LoanPayoffFigures[] {
  const flowByAccount = new Map(accountFlows.accounts.map(f => [f.accountId, f]));

  return loans.map(account => {
    const details = getAccountDetails('loan', account.details);
    if (details && details.interestRate > 0) {
      const start = calculateLoanAmortizationSummary(details, { asOfDate: shiftDateStr(dateFrom, -1) });
      const end = calculateLoanAmortizationSummary(details, { asOfDate: dateTo });
      return {
        accountId: account.id,
        accountName: account.name,
        currency: account.currency,
        remainingBalance: end.remainingPrincipal,
        paidDown: Math.max(0, start.remainingPrincipal - end.remainingPrincipal),
      };
    }

    // Zero-interest (or incomplete-params) loans: every payment is pure principal, so the raw
    // ledger balance — already computed by getAccountFlows — is the exact remaining balance.
    const flow = flowByAccount.get(account.id);
    return {
      accountId: account.id,
      accountName: account.name,
      currency: account.currency,
      remainingBalance: flow ? -flow.closingBalance : -account.balance,
      paidDown: flow ? Math.max(0, flow.closingBalance - flow.openingBalance) : 0,
    };
  });
}

function computeGoalProgress(
  accounts: FinanceAccount[],
  savingsContributions: SavingsContributionsResult,
): GoalProgress[] {
  const goals = accounts.filter(a => a.type === AccountTypes.Goal);
  // GoalProgress reports balance/targetAmount in the account's own currency, so match that with
  // the original (unconverted) contribution amount rather than the budget-currency-converted one.
  const contributionByAccount = new Map(savingsContributions.accounts.map(a => [a.accountId, a.original.amount]));

  return goals.map(account => {
    const details = getAccountDetails('goal', account.details);
    const targetAmount = details?.targetAmount ?? null;
    return {
      accountId: account.id,
      accountName: account.name,
      currency: account.currency,
      balance: account.balance,
      targetAmount,
      percentComplete: targetAmount && targetAmount > 0 ? Math.round((account.balance / targetAmount) * 100) : null,
      contributionThisPeriod: contributionByAccount.get(account.id) ?? 0,
    };
  });
}

/** Monthly finance report for one YYYY-MM month. Defaults to the last completed month. */
export async function getMonthlyFinanceReport(
  userId: string,
  budgetId: number,
  month?: string,
): Promise<MonthlyFinanceReport> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const targetMonth = month ?? dateToString(getLastMonthStart(), 'YYYY-MM');
  const { fromDate: dateFrom, toDate: dateTo } = monthToDateRange(targetMonth);

  const [accounts, cashflow, accountFlows, savingsContributions, budgetProgress, categorySpikes, newPayees] =
    await Promise.all([
      getAccounts(userId, budgetId),
      getCashflowSummary(userId, budgetId, dateFrom, dateTo),
      getAccountFlows(userId, budgetId, dateFrom, dateTo),
      getSavingsContributions(userId, budgetId, dateFrom, dateTo),
      getBudgetProgress(userId, budgetId, targetMonth),
      computeCategorySpikes(userId, budgetId, dateFrom, dateTo),
      computeNewPayees(userId, budgetId, dateFrom, dateTo),
    ]);

  const goals = computeGoalProgress(accounts, savingsContributions);
  const loans = computeLoanPayoffFigures(
    accounts.filter(a => a.type === AccountTypes.Loan),
    accountFlows,
    dateFrom,
    dateTo,
  ).map(({ paidDown, ...rest }) => ({ ...rest, paidDownThisPeriod: paidDown }));

  const dataQualityFlags = accountFlows.accounts
    .filter(a => !a.reconciles)
    .map(a => ({ accountId: a.accountId, accountName: a.accountName }));

  return {
    month: targetMonth,
    dateFrom,
    dateTo,
    cashflow,
    accountFlows,
    savingsContributions,
    budgetProgress,
    insights: { categorySpikes, newPayees, dataQualityFlags, goals, loans },
  };
}

// ─── Yearly Report ─────────────────────────────────────────────────────────────

export interface LoanPayoffProgress {
  accountId: number;
  accountName: string;
  currency: string;
  remainingBalance: number;
  paidDownThisYear: number;
}

export interface IbkrDcaProgress {
  actualContributed: number;
  targetContribution: number;
  currency: string;
}

export interface YearlyFinanceReport {
  year: number;
  dateFrom: string;
  dateTo: string;
  cashflow: CashflowSummaryResult;
  /** Net worth trajectory from persisted monthly snapshots (see snapshotNetWorth) that fall within the year. */
  netWorthHistory: NetWorthHistoryEntry[];
  netWorthDelta: number | null;
  savingsContributions: SavingsContributionsResult;
  /** Null when no portfolio has been set up. */
  ibkrDca: IbkrDcaProgress | null;
  loans: LoanPayoffProgress[];
  /** 12-month table per category (categoryId/name -> month -> total). */
  categoryByMonth: { categoryId: number | undefined; categoryName: string; months: Record<string, number> }[];
  /** Year-over-year comparison vs the prior calendar year, by category. */
  yearOverYear: ComparisonResult;
}

async function computeIbkrDca(userId: string, budgetId: number, year: number): Promise<IbkrDcaProgress | null> {
  const portfolio = await getPortfolio(userId, budgetId);
  if (!portfolio) return null;

  const supplies = await getSupplies(userId, budgetId, portfolio.id);
  const actualContributed = supplies
    .filter(s => s.date.startsWith(String(year)))
    .reduce((sum, s) => sum + s.totalAmount, 0);

  return {
    actualContributed: Math.round(actualContributed * 100) / 100,
    targetContribution: portfolio.plannedMonthlyContribution * 12,
    currency: portfolio.baseCurrency,
  };
}

async function computeCategoryByMonth(
  userId: string,
  budgetId: number,
  year: number,
): Promise<{ categoryId: number | undefined; categoryName: string; months: Record<string, number> }[]> {
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);

  // Each month's aggregate is independent — fetch all 12 concurrently rather than one at a time.
  const results = await Promise.all(
    months.map(month => {
      const { fromDate, toDate } = monthToDateRange(month);
      return getSpendingAggregates(userId, budgetId, {
        dateFrom: fromDate,
        dateTo: toDate,
        groupBy: 'category',
        type: 'expense',
      });
    }),
  );

  const rows = new Map<
    string,
    { categoryId: number | undefined; categoryName: string; months: Record<string, number> }
  >();
  results.forEach((result, i) => {
    const month = months[i]!;
    for (const group of result.groups) {
      const key = group.id !== undefined ? String(group.id) : group.key;
      const existing = rows.get(key) ?? { categoryId: group.id, categoryName: group.key, months: {} };
      existing.months[month] = group.total;
      rows.set(key, existing);
    }
  });

  return Array.from(rows.values());
}

/** Yearly finance report for one calendar year. Defaults to the last completed year. */
export async function getYearlyFinanceReport(
  userId: string,
  budgetId: number,
  year?: number,
): Promise<YearlyFinanceReport> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const budget = await getBudgetById(userId, budgetId);
  if (!budget) throw new Error('Budget not found');

  const currentYear = parseInt(currentDateString().slice(0, 4), 10);
  const targetYear = year ?? currentYear - 1;
  const dateFrom = `${targetYear}-01-01`;
  const dateTo = `${targetYear}-12-31`;

  const [
    accounts,
    cashflow,
    accountFlows,
    netWorthSummary,
    savingsContributions,
    ibkrDca,
    categoryByMonth,
    yearOverYear,
  ] = await Promise.all([
    getAccounts(userId, budgetId),
    getCashflowSummary(userId, budgetId, dateFrom, dateTo),
    getAccountFlows(userId, budgetId, dateFrom, dateTo),
    getNetWorthSummary(userId, budgetId),
    getSavingsContributions(userId, budgetId, dateFrom, dateTo),
    computeIbkrDca(userId, budgetId, targetYear),
    computeCategoryByMonth(userId, budgetId, targetYear),
    getComparison(userId, budgetId, {
      period1: { dateFrom: `${targetYear - 1}-01-01`, dateTo: `${targetYear - 1}-12-31` },
      period2: { dateFrom, dateTo },
      groupBy: 'category',
      type: 'expense',
    }),
  ]);

  const loans = computeLoanPayoffFigures(
    accounts.filter(a => a.type === AccountTypes.Loan),
    accountFlows,
    dateFrom,
    dateTo,
  ).map(({ paidDown, ...rest }) => ({ ...rest, paidDownThisYear: paidDown }));

  const netWorthHistory = netWorthSummary.history.filter(h => h.month.startsWith(String(targetYear)));
  const netWorthDelta =
    netWorthHistory.length >= 2
      ? Math.round((netWorthHistory[netWorthHistory.length - 1]!.netWorth - netWorthHistory[0]!.netWorth) * 100) / 100
      : null;

  return {
    year: targetYear,
    dateFrom,
    dateTo,
    cashflow,
    netWorthHistory,
    netWorthDelta,
    savingsContributions,
    ibkrDca,
    loans,
    categoryByMonth,
    yearOverYear,
  };
}
