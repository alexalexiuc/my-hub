/**
 * Loan amortization helpers
 * - getMonthlyPayment(principal, monthlyRate, termMonths) — standard amortization payment formula (unrounded)
 * - calculateLoanAmortizationSummary(details, opts?) — computes schedule-derived and hybrid payment summary for a loan
 * - getLoanBalanceSnapshotForAccount(userId, budgetId, account, opts?) — computes remaining principal + amortization summary for a loan account
 * - getLoanDisplayBalance(account, loanSnapshot) — resolves the balance to display for an account, substituting the amortization-derived remaining principal for interest-bearing loans
 * - getLoanCardBalance(userId, budgetId, account, opts?) — fetches the loan snapshot and resolves it via getLoanDisplayBalance in one call; the single entry point loan card UIs should use
 * - buildLoanSummary(details, totalPaid, today) — pure closed-form loan summary; k derived from (firstPaymentDate, today), not transaction count
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

// Payment k (1-indexed) is due on firstPaymentDate + (k-1) months, so the payment due on
// firstPaymentDate itself already counts — this returns the count of payments due on or
// before asOfDate, not the number of full months elapsed since firstPaymentDate.
function countScheduledPayments(firstPaymentDate: string, asOfDate: string): number {
  const start = new Date(firstPaymentDate);
  const asOf = new Date(asOfDate);

  if (asOf < start) return 0;

  let monthsElapsed = (asOf.getFullYear() - start.getFullYear()) * 12 + (asOf.getMonth() - start.getMonth());
  if (asOf.getDate() < start.getDate()) {
    monthsElapsed -= 1;
  }

  return Math.max(0, monthsElapsed) + 1;
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
  // Payment #termMonths (the last one) is due termMonths-1 months after payment #1.
  const scheduledPayoffDate = toDateString(addMonths(new Date(details.firstPaymentDate), details.termMonths - 1));

  const scheduledPaymentsMade = Math.min(
    details.termMonths,
    countScheduledPayments(details.firstPaymentDate, asOfDate),
  );
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
    actualPayoffDate: toDateString(
      addMonths(new Date(details.firstPaymentDate), paymentsMade + projection.paymentsRemaining - 1),
    ),
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

  // No fromDate filter: real-world repayments can land a few days before the scheduled
  // firstPaymentDate (e.g. paid early), and this account is dedicated to the loan (created via
  // finances_add_loan) so every non-correction transaction on it is a legitimate payment.
  const transactions = await getTransactions(userId, budgetId, {
    accountId: account.id,
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

/**
 * Resolves the balance to display for an account, given its loan snapshot (if any).
 * Loan repayments are recorded as their total amount (principal + interest), so the raw ledger
 * balance alone understates the true remaining principal once a loan carries any interest.
 * Interest-bearing loans use the amortization-derived remaining principal instead; zero-interest
 * loans have no such discrepancy (every payment is pure principal), so the ledger balance —
 * negated, since loans are stored as a negative liability — is used directly.
 * Non-loan accounts (loanSnapshot is null) return the ledger balance unchanged.
 */
export function getLoanDisplayBalance(
  account: Pick<FinanceAccount, 'balance' | 'details'>,
  loanSnapshot: LoanBalanceSnapshot | null,
): number {
  if (!loanSnapshot) return account.balance;
  const details = getAccountDetails('loan', account.details);
  return details?.interestRate === 0 ? -account.balance : loanSnapshot.balance;
}

/**
 * Fetches a loan account's balance snapshot and resolves it to the same display balance shown
 * on the account list/detail screens (getLoanDisplayBalance) — the single call every loan card UI
 * (accounts list, account detail, dashboard widget) should make instead of repeating the
 * snapshot + display-balance pairing inline. Returns null for non-loan accounts.
 */
export async function getLoanCardBalance(
  userId: string,
  budgetId: number,
  account: FinanceAccount,
  opts: {
    asOfDate?: string;
    accountCurrencyById?: Map<number, string>;
  } = {},
): Promise<{ balance: number; amortizationSummary: LoanAmortizationSummary } | null> {
  const snapshot = await getLoanBalanceSnapshotForAccount(userId, budgetId, account, opts);
  if (!snapshot) return null;
  return { balance: getLoanDisplayBalance(account, snapshot), amortizationSummary: snapshot.amortizationSummary };
}

// ─── LoanSummary (closed-form, count-based) ───────────────────────────────────

export interface LoanSummary {
  originalPrincipal: number;
  totalInterestScheduled: number;
  originalObligation: number;
  totalPaid: number;
  remainingObligation: number;
  remainingPrincipal?: number;
  remainingInterest?: number;
  paymentsCompleted: number;
  paymentsRemaining: number;
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
 * paymentsCompleted is derived from (firstPaymentDate, today) — not from transaction count.
 * totalPaid is the only transaction-derived input.
 * If any required loan param is missing or invalid the result has paramsIncomplete: true and
 * omits remainingPrincipal / remainingInterest — it never throws.
 */
export function buildLoanSummary(
  details: LoanAccountDetails | null | undefined,
  totalPaid: number,
  today: string,
): LoanSummary {
  const principal = details?.principal ?? null;
  const interestRate = details?.interestRate ?? null;
  const termMonths = details?.termMonths ?? null;
  const firstPaymentDate = details?.firstPaymentDate ?? null;

  const roundedTotalPaid = roundToTwoDecimals(Math.max(0, totalPaid));

  const paramsIncomplete =
    !firstPaymentDate ||
    principal == null ||
    principal <= 0 ||
    interestRate == null ||
    interestRate < 0 ||
    termMonths == null ||
    termMonths <= 0;

  if (paramsIncomplete) {
    const safePrincipal = Math.max(0, principal ?? 0);
    const paymentsDue = firstPaymentDate ? countScheduledPayments(firstPaymentDate, today) : 0;
    const paymentsCompleted = termMonths != null && termMonths > 0 ? Math.min(paymentsDue, termMonths) : paymentsDue;
    const paymentsRemaining = termMonths != null && termMonths > 0 ? Math.max(0, termMonths - paymentsCompleted) : 0;
    const projectedPayoffDate =
      firstPaymentDate && termMonths != null && termMonths > 0
        ? toDateString(addMonths(new Date(firstPaymentDate), termMonths - 1))
        : today;
    return {
      originalPrincipal: safePrincipal,
      totalInterestScheduled: 0,
      originalObligation: safePrincipal,
      totalPaid: roundedTotalPaid,
      remainingObligation: roundToTwoDecimals(Math.max(0, safePrincipal - roundedTotalPaid)),
      paymentsCompleted,
      paymentsRemaining,
      projectedPayoffDate,
      paramsIncomplete: true,
    };
  }

  const r = interestRate! / 100 / 12;
  const monthlyPayment = getMonthlyPayment(principal!, r, termMonths!);
  const totalInterestScheduled = roundToTwoDecimals(Math.max(0, monthlyPayment * termMonths! - principal!));
  const originalObligation = roundToTwoDecimals(principal! + totalInterestScheduled);
  const remainingObligation = roundToTwoDecimals(Math.max(0, originalObligation - roundedTotalPaid));

  const paymentsCompleted = Math.min(countScheduledPayments(firstPaymentDate!, today), termMonths!);
  const remainingPrincipal = computeRemainingPrincipal(principal!, interestRate!, termMonths!, paymentsCompleted);
  const remainingInterest = roundToTwoDecimals(Math.max(0, remainingObligation - remainingPrincipal));
  const paymentsRemaining = termMonths! - paymentsCompleted;
  const projectedPayoffDate = toDateString(addMonths(new Date(firstPaymentDate!), termMonths! - 1));

  return {
    originalPrincipal: roundToTwoDecimals(principal!),
    totalInterestScheduled,
    originalObligation,
    totalPaid: roundedTotalPaid,
    remainingObligation,
    remainingPrincipal,
    remainingInterest,
    paymentsCompleted,
    paymentsRemaining,
    projectedPayoffDate,
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

  // No fromDate filter: see getLoanBalanceSnapshotForAccount for why early payments must count.
  const transactions = await getTransactions(userId, budgetId, {
    accountId: account.id,
    includeCorrections: false,
  });

  const totalPaid = transactions
    .filter(txn => isLoanPaymentTransaction(account.id, txn) && txn.date <= today)
    .reduce((sum, txn) => {
      if (txn.type === TransactionTypes.Transfer && txn.toAccountId === account.id) {
        return sum + txn.amount * (txn.toExchangeRate ?? 1);
      }
      return sum + txn.amount;
    }, 0);

  return buildLoanSummary(details, totalPaid, today);
}
