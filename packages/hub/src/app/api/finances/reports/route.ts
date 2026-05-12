import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { getUserActiveBudget, getTransactions, getNetWorthHistory } from '@my-hub/shared/services';
import { TransactionTypes } from '@my-hub/shared/constants';
import { supportedCurrencySchema } from '../currency.schema';

export const reportsCashflowMonthSchema = z.object({
  month: z.string(),
  value: z.string(),
  income: z.number(),
  expense: z.number(),
});

export const reportsNetWorthPointSchema = z.object({
  month: z.string(),
  label: z.string(),
  netWorth: z.number(),
});

export const reportsResponseSchema = z.object({
  currency: supportedCurrencySchema,
  cashflow: z.array(reportsCashflowMonthSchema),
  netWorthHistory: z.array(reportsNetWorthPointSchema),
});

export type CashflowMonth = z.infer<typeof reportsCashflowMonthSchema>;
export type ReportsNetWorthPoint = z.infer<typeof reportsNetWorthPointSchema>;
export type ReportsData = z.infer<typeof reportsResponseSchema>;

const ReportsQuerySchema = z.object({
  months: z.coerce.number().int().positive().max(12).optional(),
});

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

export const GET = route({ query: ReportsQuerySchema, response: reportsResponseSchema })(async ({ user, query }) => {
  const months = Math.min(query.months ?? 6, 12);

  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const budgetId = budget.id;

  const now = new Date();
  const fromDate = `${addMonths(now, -(months - 1)).getFullYear()}-${String(addMonths(now, -(months - 1)).getMonth() + 1).padStart(2, '0')}-01`;
  const toDate = now.toISOString().slice(0, 10);

  const [expenseTxns, incomeTxns, nwHistory] = await Promise.all([
    getTransactions(user.id, budgetId, { type: TransactionTypes.Expense, fromDate, toDate, limit: 5000 }),
    getTransactions(user.id, budgetId, { type: TransactionTypes.Income, fromDate, toDate, limit: 5000 }),
    getNetWorthHistory(user.id, budgetId, months),
  ]);

  const monthMap = new Map<string, { income: number; expense: number }>();
  for (let i = months - 1; i >= 0; i--) {
    const d = addMonths(now, -i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap.set(key, { income: 0, expense: 0 });
  }

  for (const t of expenseTxns) {
    const key = t.date.slice(0, 7);
    const entry = monthMap.get(key);
    if (entry) entry.expense += t.amount;
  }
  for (const t of incomeTxns) {
    const key = t.date.slice(0, 7);
    const entry = monthMap.get(key);
    if (entry) entry.income += t.amount;
  }

  const cashflow: CashflowMonth[] = Array.from(monthMap.entries()).map(([value, totals]) => ({
    value,
    month: new Date(value + '-01').toLocaleDateString('en-IE', { month: 'short' }),
    income: Math.round(totals.income * 100) / 100,
    expense: Math.round(totals.expense * 100) / 100,
  }));

  const netWorthHistory = nwHistory.map(s => ({
    month: s.month,
    label: new Date(s.month + '-01').toLocaleDateString('en-IE', { month: 'short' }),
    netWorth: s.netWorth,
  }));

  const data: ReportsData = { currency: budget.defaultCurrency, cashflow, netWorthHistory };
  return data;
});
