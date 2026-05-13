import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { getAccountById, getUserActiveBudget, getLoanBalanceSnapshotForAccount } from '@my-hub/shared/services';
import type { LoanAccountDetails } from '@my-hub/shared/types';
import { supportedCurrencySchema } from '../../../currency.schema';

/** Currency-unit tolerance used to account for floating-point drift in schedule balance comparisons. */
const BALANCE_COMPARISON_TOLERANCE = 0.01;

export const scheduleRowSchema = z.object({
  n: z.number().int(),
  date: z.string(),
  principalPart: z.number(),
  interestPart: z.number(),
  balance: z.number(),
  paid: z.boolean(),
  current: z.boolean(),
});

export const amortizationResponseSchema = z.object({
  accountId: z.number().int(),
  name: z.string(),
  currency: supportedCurrencySchema,
  currentBalance: z.number(),
  principal: z.number(),
  interestRate: z.number(),
  termMonths: z.number().int(),
  monthlyPayment: z.number(),
  startDate: z.string(),
  nextPaymentDate: z.string(),
  paymentsMade: z.number().int(),
  paymentsRemaining: z.number().int(),
  totalInterestPaid: z.number(),
  totalInterestRemaining: z.number(),
  totalCost: z.number(),
  scheduledPayoffDate: z.string(),
  actualPayoffDate: z.string().nullable(),
  interestSavedVsSchedule: z.number().nullable(),
  rows: z.array(scheduleRowSchema),
});

export type ScheduleRow = z.infer<typeof scheduleRowSchema>;
export type AmortizationData = z.infer<typeof amortizationResponseSchema>;

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const GET = route({
  params: z.object({ id: z.string() }),
  response: amortizationResponseSchema,
})(async ({ user, params }) => {
  const accountId = Number(params.id);
  if (isNaN(accountId)) routeHttpError(400, { error: 'Invalid id' });

  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const account = await getAccountById(user.id, budget.id, accountId);
  if (!account) routeHttpError(404, { error: 'Account not found' });
  if (account.type !== 'loan') routeHttpError(400, { error: 'Not a loan account' });

  const rawDetails = account.details;
  if (!rawDetails || (rawDetails as { type?: string }).type !== 'loan') {
    routeHttpError(400, {
      error: 'Loan account is missing required details (principal, interestRate, termMonths, startDate).',
    });
  }

  const details = rawDetails as LoanAccountDetails;
  const { principal, interestRate, termMonths, startDate } = details;
  const loanSnapshot = await getLoanBalanceSnapshotForAccount(user.id, budget.id, account);
  const amortizationSummary = loanSnapshot?.amortizationSummary;
  const currentBalance = loanSnapshot?.balance ?? account.balance;

  // Monthly payment
  const r = interestRate / 100 / 12;
  const monthlyPayment =
    r === 0
      ? principal / termMonths
      : (principal * r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);

  // Build schedule
  const start = new Date(startDate);
  const rows: ScheduleRow[] = [];
  let balance = principal;

  for (let n = 1; n <= termMonths; n++) {
    const interestPart = balance * r;
    const principalPart = Math.min(monthlyPayment - interestPart, balance);
    balance = Math.max(0, balance - principalPart);
    const date = toDateStr(addMonths(start, n));

    rows.push({
      n,
      date,
      principalPart: Math.round(principalPart * 100) / 100,
      interestPart: Math.round(interestPart * 100) / 100,
      balance: Math.round(balance * 100) / 100,
      paid: false,
      current: false,
    });
  }

  let nextIdx = rows.findIndex(r => r.balance <= currentBalance + BALANCE_COMPARISON_TOLERANCE);
  if (nextIdx === -1) nextIdx = rows.length;
  if (amortizationSummary) {
    // Prefer hybrid-derived payment count when available because balance-based lookup assumes fixed scheduled payments.
    nextIdx = Math.min(amortizationSummary.paymentsMade, rows.length);
  }

  for (let i = 0; i < nextIdx; i++) rows[i]!.paid = true;
  if (nextIdx < rows.length && currentBalance > 0) rows[nextIdx]!.current = true;

  const nextPaymentDate = nextIdx < rows.length && currentBalance > 0 ? rows[nextIdx]!.date : '';

  const data: AmortizationData = {
    accountId,
    name: account.name,
    currency: account.currency,
    currentBalance,
    principal,
    interestRate,
    termMonths,
    monthlyPayment: Math.round(monthlyPayment * 100) / 100,
    startDate,
    nextPaymentDate,
    paymentsMade: amortizationSummary?.paymentsMade ?? 0,
    paymentsRemaining: amortizationSummary?.paymentsRemaining ?? Math.max(0, termMonths - nextIdx),
    totalInterestPaid: amortizationSummary?.totalInterestPaid ?? 0,
    totalInterestRemaining: amortizationSummary?.totalInterestRemaining ?? 0,
    totalCost: amortizationSummary?.totalCost ?? principal,
    scheduledPayoffDate: amortizationSummary?.scheduledPayoffDate ?? '',
    actualPayoffDate: amortizationSummary?.actualPayoffDate ?? null,
    interestSavedVsSchedule: amortizationSummary?.interestSavedVsSchedule ?? null,
    rows,
  };

  return data;
});
