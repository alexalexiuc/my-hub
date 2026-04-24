import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { getUserBudgets, getAccounts, getNetWorthHistory } from '@my-hub/shared/services';
import { AccountTypes } from '@my-hub/shared/constants';

const LIABILITY_TYPES = new Set<string>([AccountTypes.Loan, AccountTypes.CreditCard]);

export interface NetWorthData {
  currency: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  assets: { id: number; name: string; type: string; balance: number; currency: string }[];
  liabilities: { id: number; name: string; type: string; balance: number; currency: string }[];
  history: { month: string; label: string; totalAssets: number; totalLiabilities: number; netWorth: number }[];
  deltaVsLastMonth: number | null;
}

export const GET = withAuth(async ({ user }) => {
  const budgets = await getUserBudgets(user.id);
  const budget = budgets[0];
  if (!budget) return NextResponse.json({ error: 'No budget found' }, { status: 404 });

  const budgetId = budget.id;
  const [accounts, snapshots] = await Promise.all([
    getAccounts(user.id, budgetId),
    getNetWorthHistory(user.id, budgetId, 12),
  ]);

  let totalAssets = 0;
  let totalLiabilities = 0;
  const assets: NetWorthData['assets'] = [];
  const liabilities: NetWorthData['liabilities'] = [];

  for (const a of accounts) {
    const bal = parseFloat(a.balance);
    const item = { id: a.id, name: a.name, type: a.type, balance: bal, currency: a.currency };
    if (LIABILITY_TYPES.has(a.type)) {
      totalLiabilities += bal;
      liabilities.push(item);
    } else {
      totalAssets += bal;
      assets.push(item);
    }
  }

  const netWorth = totalAssets - totalLiabilities;

  const history = snapshots.map(s => ({
    month: s.month,
    label: new Date(s.month + '-01').toLocaleDateString('en-IE', { month: 'short' }),
    totalAssets: s.totalAssets,
    totalLiabilities: s.totalLiabilities,
    netWorth: s.netWorth,
  }));

  const prev = history[history.length - 2];
  const last = history[history.length - 1];
  const deltaVsLastMonth = prev && last ? last.netWorth - prev.netWorth : null;

  const data: NetWorthData = {
    currency: budget.defaultCurrency,
    netWorth,
    totalAssets,
    totalLiabilities,
    assets,
    liabilities,
    history,
    deltaVsLastMonth,
  };

  return NextResponse.json(data);
});
