import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { getUserBudgets, getPayees, getCategories, getTransactions } from '@my-hub/shared/services';

export interface PayeeReportItem {
  id: number;
  name: string;
  txCount: number;
  totalSpent: number;
  lastDate: string;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
}

function getFromDate(range: string): string {
  const now = new Date();
  if (range === '3m') {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 10);
  }
  if (range === 'ytd') return `${now.getFullYear()}-01-01`;
  // default: 30d
  const d = new Date(now);
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export const GET = withAuth(async ({ req, user }) => {
  const { searchParams } = new URL(req.url);
  const range = searchParams.get('range') ?? '30d';

  const budgets = await getUserBudgets(user.id);
  const budget = budgets[0];
  if (!budget) return NextResponse.json({ error: 'No budget found' }, { status: 404 });

  const budgetId = budget.id;
  const fromDate = getFromDate(range);
  const toDate = new Date().toISOString().slice(0, 10);

  const [payees, categories, txns] = await Promise.all([
    getPayees(user.id, budgetId),
    getCategories(user.id, budgetId),
    getTransactions(user.id, budgetId, { type: 'expense', fromDate, toDate, limit: 2000 }),
  ]);

  const payeeMap = new Map(payees.map(p => [p.id, p]));
  const categoryMap = new Map(categories.map(c => [c.id, c]));

  // Aggregate by payeeId
  const agg = new Map<
    number,
    { txCount: number; totalSpent: number; lastDate: string; lastCategoryId: number | null }
  >();

  for (const t of txns) {
    if (t.payeeId == null) continue;
    const existing = agg.get(t.payeeId);
    if (!existing) {
      agg.set(t.payeeId, {
        txCount: 1,
        totalSpent: parseFloat(t.amount),
        lastDate: t.date,
        lastCategoryId: t.categoryId ?? null,
      });
    } else {
      existing.txCount++;
      existing.totalSpent += parseFloat(t.amount);
      if (t.date > existing.lastDate) {
        existing.lastDate = t.date;
        existing.lastCategoryId = t.categoryId ?? null;
      }
    }
  }

  const items: PayeeReportItem[] = Array.from(agg.entries())
    .map(([payeeId, stats]) => {
      const payee = payeeMap.get(payeeId);
      const cat = stats.lastCategoryId != null ? categoryMap.get(stats.lastCategoryId) : undefined;
      return {
        id: payeeId,
        name: payee?.name ?? '—',
        txCount: stats.txCount,
        totalSpent: Math.round(stats.totalSpent * 100) / 100,
        lastDate: stats.lastDate,
        categoryName: cat?.name ?? null,
        categoryColor: cat?.color ?? null,
        categoryIcon: cat?.icon ?? null,
      };
    })
    .sort((a, b) => b.totalSpent - a.totalSpent);

  return NextResponse.json({ currency: budget.defaultCurrency, payees: items });
});
