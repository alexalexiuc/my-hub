import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { getUserBudgets, getAccounts, getTransactions } from '@my-hub/shared/services';
import { AccountTypes } from '@my-hub/shared/constants';
import type { GoalAccountDetails } from '@my-hub/shared/constants';

export interface GoalItem {
  id: number;
  name: string;
  currency: string;
  balance: number;
  targetAmount: number;
  monthlyAvg: number;
  projectedMonths: number | null;
}

export const GET = withAuth(async ({ user }) => {
  const budgets = await getUserBudgets(user.id);
  const budget = budgets[0];
  if (!budget) return NextResponse.json({ error: 'No budget found' }, { status: 404 });

  const budgetId = budget.id;
  const allAccounts = await getAccounts(user.id, budgetId);
  const goalAccounts = allAccounts.filter(a => a.type === AccountTypes.Goal);

  if (!goalAccounts.length) {
    return NextResponse.json({ currency: budget.defaultCurrency, goals: [] });
  }

  const goalIds = new Set(goalAccounts.map(a => a.id));

  const now = new Date();
  const d3m = new Date(now);
  d3m.setMonth(d3m.getMonth() - 3);
  const fromDate = d3m.toISOString().slice(0, 10);
  const toDate = now.toISOString().slice(0, 10);

  const recentTxns = await getTransactions(user.id, budgetId, { fromDate, toDate, limit: 1000 });

  // Sum inflows per goal: transfers where toAccountId is a goal account
  const inflowByGoal = new Map<number, number>();
  for (const t of recentTxns) {
    if (t.toAccountId != null && goalIds.has(t.toAccountId)) {
      inflowByGoal.set(t.toAccountId, (inflowByGoal.get(t.toAccountId) ?? 0) + parseFloat(t.amount));
    }
  }

  const goals: GoalItem[] = goalAccounts.map(a => {
    const details = a.details as GoalAccountDetails | null;
    const targetAmount = details?.targetAmount ?? 0;
    const balance = parseFloat(a.balance);
    const totalInflow = inflowByGoal.get(a.id) ?? 0;
    const monthlyAvg = Math.round((totalInflow / 3) * 100) / 100;
    const remaining = targetAmount - balance;
    const projectedMonths = monthlyAvg > 0 && remaining > 0 ? Math.ceil(remaining / monthlyAvg) : null;
    return { id: a.id, name: a.name, currency: a.currency, balance, targetAmount, monthlyAvg, projectedMonths };
  });

  return NextResponse.json({ currency: budget.defaultCurrency, goals });
});
