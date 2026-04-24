import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { getUserBudgets, getTransactions, getNetWorthHistory } from '@my-hub/shared/services';

export interface CashflowMonth {
  month: string; // short label e.g. "Jan"
  value: string; // YYYY-MM
  income: number;
  expense: number;
}

export interface ReportsData {
  currency: string;
  cashflow: CashflowMonth[];
  netWorthHistory: { month: string; label: string; netWorth: number }[];
}

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

export const GET = withAuth(async ({ req, user }) => {
  const { searchParams } = new URL(req.url);
  const months = Math.min(Number(searchParams.get('months') ?? 6), 12);

  const budgets = await getUserBudgets(user.id);
  const budget = budgets[0];
  if (!budget) return NextResponse.json({ error: 'No budget found' }, { status: 404 });

  const budgetId = budget.id;

  const now = new Date();
  const fromDate = `${addMonths(now, -(months - 1)).getFullYear()}-${String(addMonths(now, -(months - 1)).getMonth() + 1).padStart(2, '0')}-01`;
  const toDate = now.toISOString().slice(0, 10);

  const [expenseTxns, incomeTxns, nwHistory] = await Promise.all([
    getTransactions(user.id, budgetId, { type: 'expense', fromDate, toDate, limit: 5000 }),
    getTransactions(user.id, budgetId, { type: 'income', fromDate, toDate, limit: 5000 }),
    getNetWorthHistory(user.id, budgetId, months),
  ]);

  // Aggregate per month
  const monthMap = new Map<string, { income: number; expense: number }>();
  for (let i = months - 1; i >= 0; i--) {
    const d = addMonths(now, -i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap.set(key, { income: 0, expense: 0 });
  }

  for (const t of expenseTxns) {
    const key = t.date.slice(0, 7);
    const entry = monthMap.get(key);
    if (entry) entry.expense += parseFloat(t.amount);
  }
  for (const t of incomeTxns) {
    const key = t.date.slice(0, 7);
    const entry = monthMap.get(key);
    if (entry) entry.income += parseFloat(t.amount);
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
  return NextResponse.json(data);
});
