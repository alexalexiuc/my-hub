import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { getAccountById, getUserActiveBudget } from '@my-hub/shared/services';
import type { LoanAccountDetails } from '@my-hub/shared/constants';
import { amortizationResponseSchema } from '../../../contracts';
import type { AmortizationData, ScheduleRow } from '../../../contracts';

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

  const details = account.details as LoanAccountDetails;
  const { principal, interestRate, termMonths, startDate } = details;
  const currentBalance = account.balance;

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

  // Mark paid rows: balance after payment > currentBalance means it's been paid
  // Find the first row where balance <= currentBalance — that's the next payment
  let nextIdx = rows.findIndex(r => r.balance <= currentBalance + 0.01);
  if (nextIdx === -1) nextIdx = rows.length; // all paid

  for (let i = 0; i < nextIdx; i++) rows[i]!.paid = true;
  if (nextIdx < rows.length) rows[nextIdx]!.current = true;

  const nextPaymentDate = nextIdx < rows.length ? rows[nextIdx]!.date : '';

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
    rows,
  };

  return data;
});
