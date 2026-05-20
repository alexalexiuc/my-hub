/**
 * Loan amortization helpers
 * - getMonthlyPayment(principal, monthlyRate, termMonths) — standard amortization payment formula (unrounded)
 * - calculateLoanAmortizationSummary(details, opts?) — computes schedule-derived and hybrid payment summary for a loan
 * - getLoanBalanceSnapshotForAccount(userId, budgetId, account, opts?) — computes remaining principal + amortization summary for a loan account
 * - buildLoanSummary(details, paymentsCompleted, totalPaid, today) — pure closed-form loan summary (no DB access); safe for direct testing
 * - getLoanSummaryForAccount(userId, budgetId, account, opts?) — fetches transactions then calls buildLoanSummary
 * Types: LoanPaymentHistoryEntry, LoanAmortizationSummary, LoanBalanceSnapshot, LoanSummary
 */
import { AccountTypes, TransactionTypes } from '../../constants/finances';
import { currentDateString } from '../../utils';
import { getAccountDetails, type FinanceAccount, type LoanAccountDetails } from '../../types';
import { getAccounts } from './accounts';
import { getTransactions } from './transactions';

export interface LoanPaymentHistoryEntry {
  amount: number;
  date: string;
  currencyMismatch?: boolean;
}

export interface LoanAmortizationSummary {
  monthlyPayment: number;
  paymentsMade: number;
  paymentsRemaining: number;
  remainingPrincipal: number;
  totalInterestPaid: number;
  totalInterestRemaining: number;
  totalCost: number;
  scheduledPayoffDate: string;
  actualPayoffDate?: string;
  interestSavedVsSchedule?: number;
}

export interface LoanBalanceSnapshot {
  balance: number;
  amortizationSummary: LoanAmortizationSummary;
}

interface LoanScheduleState {
  remainingPrincipal: number;
  totalInterestPaid: number;
  paymentsMade: number;
}

// Safety guard against runaway projections (for example, underpaying loans where principal never decreases).
const MAX_PROJECTION_ITERATIONS = 1000;

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function countScheduledPayments(startDate: string, asOfDate: string): number {
  const start = new Date(startDate);
  const asOf = new Date(asOfDate);

  if (asOf < start) return 0;

  let months = (asOf.getFullYear() - start.getFullYear()) * 12 + (asOf.getMonth() - start.getMonth());
  if (asOf.getDate() < start.getDate()) {
    months -= 1;
  }

  return Math.max(0, months);
}

export function getMonthlyPayment(principal: number, monthlyRate: number, termMonths: number): number {
  if (termMonths <= 0) return 0;
  if (monthlyRate === 0) return principal / termMonths;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));
}

function applyPayment(remainingPrincipal: number, monthlyRate: number, paymentAmount: number): LoanScheduleState {
  const interest = monthlyRate === 0 ? 0 : remainingPrincipal * monthlyRate;
  const interestPaid = Math.min(paymentAmount, interest);
  const principalPaid = paymentAmount - interestPaid;

  return {
    remainingPrincipal: Math.max(0, remainingPrincipal - principalPaid),
    totalInterestPaid: interestPaid,
    paymentsMade: 1,
  };
}

function walkPaymentSequence(
  principal: number,
  monthlyRate: number,
  paymentAmount: number,
  paymentsCount: number,
): LoanScheduleState {
  let remainingPrincipal = principal;
  let totalInterestPaid = 0;
  let paymentsMade = 0;

  for (let i = 0; i < paymentsCount && remainingPrincipal > 0; i++) {
    const step = applyPayment(remainingPrincipal, monthlyRate, paymentAmount);
    remainingPrincipal = step.remainingPrincipal;
    totalInterestPaid += step.totalInterestPaid;
    paymentsMade += 1;
  }

  return {
    remainingPrincipal,
    totalInterestPaid,
    paymentsMade,
  };
}

function projectToPayoff(
  remainingPrincipal: number,
  monthlyRate: number,
  monthlyPayment: number,
): { paymentsRemaining: number; totalInterestRemaining: number; canProject: boolean } {
  if (remainingPrincipal <= 0) {
    return { paymentsRemaining: 0, totalInterestRemaining: 0, canProject: true };
  }

  let paymentsRemaining = 0;
  let totalInterestRemaining = 0;
  let balance = remainingPrincipal;

  while (balance > 0 && paymentsRemaining < MAX_PROJECTION_ITERATIONS) {
    const interest = monthlyRate === 0 ? 0 : balance * monthlyRate;
    const principalPaid = monthlyPayment - interest;
    if (principalPaid <= 0) {
      return { paymentsRemaining, totalInterestRemaining, canProject: false };
    }
    balance = Math.max(0, balance - principalPaid);
    totalInterestRemaining += interest;
    paymentsRemaining += 1;
  }

  return {
    paymentsRemaining,
    totalInterestRemaining,
    canProject: paymentsRemaining < MAX_PROJECTION_ITERATIONS,
  };
}

function isLoanPaymentTransaction(
  accountId: number,
  txn: Awaited<ReturnType<typeof getTransactions>>[number],
): boolean {
  if (txn.type === TransactionTypes.Transfer) {
    return txn.toAccountId === accountId;
  }
  return txn.accountId === accountId && txn.type === TransactionTypes.Income;
}

function compareTransactionsByDateAndId(
  left: Awaited<ReturnType<typeof getTransactions>>[number],
  right: Awaited<ReturnType<typeof getTransactions>>[number],
): number {
  if (left.date !== right.date) return left.date.localeCompare(right.date);
  return left.id - right.id;
}

export function calculateLoanAmortizationSummary(
  details: LoanAccountDetails,
  opts: {
    asOfDate?: string;
    paymentHistory?: LoanPaymentHistoryEntry[];
  } = {},
): LoanAmortizationSummary {
  // Evaluate "today" at call time so each invocation can reflect current-date changes.
  const asOfDate = opts.asOfDate ?? currentDateString();
  const monthlyRate = details.interestRate / 100 / 12;
  const monthlyPayment = getMonthlyPayment(details.principal, monthlyRate, details.termMonths);
  const scheduledPayoffDate = toDateString(addMonths(new Date(details.startDate), details.termMonths));

  const scheduledPaymentsMade = Math.min(details.termMonths, countScheduledPayments(details.startDate, asOfDate));
  const scheduledNow = walkPaymentSequence(details.principal, monthlyRate, monthlyPayment, scheduledPaymentsMade);
  const scheduledEnd = walkPaymentSequence(details.principal, monthlyRate, monthlyPayment, details.termMonths);
  const scheduledTotalInterest = scheduledEnd.totalInterestPaid;
  const totalCost = details.principal + scheduledTotalInterest;

  let summary: LoanAmortizationSummary = {
    monthlyPayment: roundToTwoDecimals(monthlyPayment),
    paymentsMade: scheduledPaymentsMade,
    paymentsRemaining: Math.max(0, details.termMonths - scheduledPaymentsMade),
    remainingPrincipal: roundToTwoDecimals(scheduledNow.remainingPrincipal),
    totalInterestPaid: roundToTwoDecimals(scheduledNow.totalInterestPaid),
    totalInterestRemaining: roundToTwoDecimals(Math.max(0, scheduledTotalInterest - scheduledNow.totalInterestPaid)),
    totalCost: roundToTwoDecimals(totalCost),
    scheduledPayoffDate,
  };

  const paymentHistory = (opts.paymentHistory ?? [])
    // Dates are normalized as YYYY-MM-DD strings across finance transactions.
    .filter(payment => payment.date <= asOfDate && payment.amount > 0)
    .sort((left, right) => left.date.localeCompare(right.date));

  const hasCurrencyMismatch = paymentHistory.some(payment => payment.currencyMismatch === true);
  if (hasCurrencyMismatch || paymentHistory.length === 0) {
    return summary;
  }

  let remainingPrincipal = details.principal;
  let totalInterestPaid = 0;
  let paymentsMade = 0;

  for (const payment of paymentHistory) {
    const step = applyPayment(remainingPrincipal, monthlyRate, payment.amount);
    remainingPrincipal = step.remainingPrincipal;
    totalInterestPaid += step.totalInterestPaid;
    paymentsMade += 1;
    if (remainingPrincipal <= 0) break;
  }

  const projection = projectToPayoff(remainingPrincipal, monthlyRate, monthlyPayment);
  if (!projection.canProject) {
    return {
      ...summary,
      paymentsMade,
      remainingPrincipal: roundToTwoDecimals(remainingPrincipal),
      totalInterestPaid: roundToTwoDecimals(totalInterestPaid),
    };
  }

  const expectedTotalInterestHybrid = totalInterestPaid + projection.totalInterestRemaining;

  summary = {
    ...summary,
    paymentsMade,
    paymentsRemaining: projection.paymentsRemaining,
    remainingPrincipal: roundToTwoDecimals(remainingPrincipal),
    totalInterestPaid: roundToTwoDecimals(totalInterestPaid),
    totalInterestRemaining: roundToTwoDecimals(projection.totalInterestRemaining),
    actualPayoffDate: toDateString(addMonths(new Date(details.startDate), paymentsMade + projection.paymentsRemaining)),
    interestSavedVsSchedule: roundToTwoDecimals(Math.max(0, scheduledTotalInterest - expectedTotalInterestHybrid)),
  };

  return summary;
}

export async function getLoanBalanceSnapshotForAccount(
  userId: string,
  budgetId: number,
  account: FinanceAccount,
  opts: {
    asOfDate?: string;
    accountCurrencyById?: Map<number, string>;
  } = {},
): Promise<LoanBalanceSnapshot | null> {
  if (account.type !== AccountTypes.Loan) return null;

  const details = getAccountDetails('loan', account.details);
  if (!details) return null;

  const accountCurrencyById =
    opts.accountCurrencyById ??
    new Map(
      (await getAccounts(userId, budgetId, { includeArchived: true })).map(current => [current.id, current.currency]),
    );

  const transactions = await getTransactions(userId, budgetId, {
    accountId: account.id,
    fromDate: details.startDate,
    includeCorrections: false,
  });

  const paymentHistory: LoanPaymentHistoryEntry[] = transactions
    .filter(txn => isLoanPaymentTransaction(account.id, txn))
    .sort(compareTransactionsByDateAndId)
    .map(txn => {
      if (txn.type === TransactionTypes.Transfer && txn.toAccountId === account.id) {
        const sourceCurrency = accountCurrencyById.get(txn.accountId);
        const currencyMismatch = !sourceCurrency || sourceCurrency !== account.currency;
        return {
          // toExchangeRate is stored as source-account currency -> destination-account currency.
          amount: txn.amount * (txn.toExchangeRate ?? 1),
          date: txn.date,
          currencyMismatch,
        };
      }

      return {
        amount: txn.amount,
        date: txn.date,
        currencyMismatch: false,
      };
    });

  const amortizationSummary = calculateLoanAmortizationSummary(details, {
    asOfDate: opts.asOfDate,
    paymentHistory,
  });

  return {
    balance: amortizationSummary.remainingPrincipal,
    amortizationSummary,
  };
}

// ─── LoanSummary (closed-form, count-based) ───────────────────────────────────

export interface LoanSummary {
  originalPrincipal: number;
  /** monthlyPayment × termMonths − principal */
  totalInterestScheduled: number;
  /** originalPrincipal + totalInterestScheduled */
  originalObligation: number;
  /** sum of all payment transactions in loan currency */
  totalPaid: number;
  /** originalObligation − totalPaid */
  remainingObligation: number;
  /** closed-form amortization at k payments; absent when paramsIncomplete */
  remainingPrincipal?: number;
  /** remainingObligation − remainingPrincipal; absent when paramsIncomplete */
  remainingInterest?: number;
  paymentsCompleted: number;
  /** termMonths − paymentsCompleted */
  paymentsRemaining: number;
  /** ISO date: today + paymentsRemaining months */
  projectedPayoffDate: string;
  paramsIncomplete?: true;
}

/**
 * Closed-form remaining principal after k scheduled payments.
 * Uses the standard amortization formula; clamps to [0, principal].
 */
function computeRemainingPrincipal(principal: number, annualRate: number, termMonths: number, k: number): number {
  if (k <= 0) return roundToTwoDecimals(principal);
  if (k >= termMonths) return 0;
  const r = annualRate / 100 / 12;
  if (r === 0) {
    return roundToTwoDecimals(Math.max(0, principal * (1 - k / termMonths)));
  }
  const monthlyPayment = getMonthlyPayment(principal, r, termMonths);
  const factor = Math.pow(1 + r, k);
  return roundToTwoDecimals(Math.max(0, principal * factor - (monthlyPayment * (factor - 1)) / r));
}

/**
 * Pure (no DB access) loan summary using the closed-form amortization formula.
 * Pass paymentsCompleted = count of actual payment transactions and totalPaid = their sum.
 * If any required loan param is missing or invalid the result has paramsIncomplete: true and
 * omits remainingPrincipal / remainingInterest — it never throws.
 */
export function buildLoanSummary(
  details: LoanAccountDetails | null | undefined,
  paymentsCompleted: number,
  totalPaid: number,
  today: string,
): LoanSummary {
  const principal = details?.principal ?? null;
  const interestRate = details?.interestRate ?? null;
  const termMonths = details?.termMonths ?? null;

  const safePaymentsCompleted = Math.max(0, paymentsCompleted);
  const roundedTotalPaid = roundToTwoDecimals(Math.max(0, totalPaid));

  const paramsIncomplete =
    principal == null ||
    principal <= 0 ||
    interestRate == null ||
    interestRate < 0 ||
    termMonths == null ||
    termMonths <= 0;

  if (paramsIncomplete) {
    const safeTermMonths = termMonths != null && termMonths > 0 ? termMonths : 0;
    const safePrincipal = principal != null && principal > 0 ? principal : 0;
    const paymentsRemaining = Math.max(0, safeTermMonths - safePaymentsCompleted);
    return {
      originalPrincipal: safePrincipal,
      totalInterestScheduled: 0,
      originalObligation: safePrincipal,
      totalPaid: roundedTotalPaid,
      remainingObligation: roundToTwoDecimals(Math.max(0, safePrincipal - roundedTotalPaid)),
      paymentsCompleted: safePaymentsCompleted,
      paymentsRemaining,
      projectedPayoffDate: toDateString(addMonths(new Date(today), paymentsRemaining)),
      paramsIncomplete: true,
    };
  }

  const r = interestRate! / 100 / 12;
  const monthlyPayment = getMonthlyPayment(principal!, r, termMonths!);
  const totalInterestScheduled = roundToTwoDecimals(Math.max(0, monthlyPayment * termMonths! - principal!));
  const originalObligation = roundToTwoDecimals(principal! + totalInterestScheduled);
  const remainingObligation = roundToTwoDecimals(Math.max(0, originalObligation - roundedTotalPaid));

  const k = Math.min(safePaymentsCompleted, termMonths!);
  const remainingPrincipal = computeRemainingPrincipal(principal!, interestRate!, termMonths!, k);
  const remainingInterest = roundToTwoDecimals(Math.max(0, remainingObligation - remainingPrincipal));
  const paymentsRemaining = Math.max(0, termMonths! - safePaymentsCompleted);

  return {
    originalPrincipal: roundToTwoDecimals(principal!),
    totalInterestScheduled,
    originalObligation,
    totalPaid: roundedTotalPaid,
    remainingObligation,
    remainingPrincipal,
    remainingInterest,
    paymentsCompleted: safePaymentsCompleted,
    paymentsRemaining,
    projectedPayoffDate: toDateString(addMonths(new Date(today), paymentsRemaining)),
  };
}

/**
 * Fetches payment transactions for a loan account and returns its LoanSummary.
 * Returns null for non-loan accounts.
 */
export async function getLoanSummaryForAccount(
  userId: string,
  budgetId: number,
  account: FinanceAccount,
  opts: {
    asOfDate?: string;
  } = {},
): Promise<LoanSummary | null> {
  if (account.type !== AccountTypes.Loan) return null;

  const details = getAccountDetails('loan', account.details);
  const today = opts.asOfDate ?? currentDateString();

  const transactions = await getTransactions(userId, budgetId, {
    accountId: account.id,
    ...(details?.startDate ? { fromDate: details.startDate } : {}),
    includeCorrections: false,
  });

  const payments = transactions
    .filter(txn => isLoanPaymentTransaction(account.id, txn) && txn.date <= today)
    .sort(compareTransactionsByDateAndId);

  const paymentsCompleted = payments.length;
  const totalPaid = payments.reduce((sum, txn) => {
    if (txn.type === TransactionTypes.Transfer && txn.toAccountId === account.id) {
      return sum + txn.amount * (txn.toExchangeRate ?? 1);
    }
    return sum + txn.amount;
  }, 0);

  return buildLoanSummary(details, paymentsCompleted, totalPaid, today);
}
