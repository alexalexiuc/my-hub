import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { getAccountById, getUserActiveBudget } from '@my-hub/shared/services';
import type { LoanAccountDetails } from '@my-hub/shared/types';
import { supportedCurrencySchema } from '../../../currency.schema';

export const scheduleRowSchema = z.object({
  n: z.number().int(),
  date: z.string(),
  principalPart: z.number(),
  interestPart: z.number(),
  balance: z.number(),
  past: z.boolean(),
  next: z.boolean(),
});

export const amortizationResponseSchema = z.object({
  accountId: z.number().int(),
  name: z.string(),
  currency: supportedCurrencySchema,
  principal: z.number(),
  interestRate: z.number(),
  termMonths: z.number().int(),
  monthlyPayment: z.number(),
  firstPaymentDate: z.string(),
  payoffDate: z.string(),
  totalCost: z.number(),
  totalInterest: z.number(),
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
    routeHttpError(400, { error: 'Loan account is missing required details.' });
  }

  const { principal, interestRate, termMonths, firstPaymentDate } = rawDetails as LoanAccountDetails;
  const r = interestRate / 100 / 12;
  const monthlyPayment =
    r === 0
      ? principal / termMonths
      : (principal * r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
  const monthlyPaymentRounded = Math.round(monthlyPayment * 100) / 100;

  // Payment #termMonths (the last one) is due termMonths-1 months after payment #1 (firstPaymentDate).
  const payoffDate = toDateStr(addMonths(new Date(firstPaymentDate), termMonths - 1));
  const totalCost = Math.round(monthlyPaymentRounded * termMonths * 100) / 100;
  const totalInterest = Math.round((totalCost - principal) * 100) / 100;

  const today = new Date().toISOString().slice(0, 10);
  const start = new Date(firstPaymentDate);
  const rows: ScheduleRow[] = [];
  let balance = principal;

  for (let n = 1; n <= termMonths; n++) {
    const interestPart = Math.round(balance * r * 100) / 100;
    const principalPart = Math.round(Math.min(monthlyPaymentRounded - interestPart, balance) * 100) / 100;
    balance = Math.round(Math.max(0, balance - principalPart) * 100) / 100;
    // Payment n (1-indexed) is due n-1 months after firstPaymentDate.
    const date = toDateStr(addMonths(start, n - 1));
    rows.push({ n, date, principalPart, interestPart, balance, past: false, next: false });
  }

  // Mark rows purely by date — no transaction inference
  const nextIdx = rows.findIndex(r => r.date > today);
  const cutoff = nextIdx === -1 ? rows.length : nextIdx;
  for (let i = 0; i < cutoff; i++) rows[i]!.past = true;
  if (nextIdx !== -1) rows[nextIdx]!.next = true;

  return {
    accountId,
    name: account.name,
    currency: account.currency,
    principal,
    interestRate,
    termMonths,
    monthlyPayment: monthlyPaymentRounded,
    firstPaymentDate,
    payoffDate,
    totalCost,
    totalInterest,
    rows,
  };
});
