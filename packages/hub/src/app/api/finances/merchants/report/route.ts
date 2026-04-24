import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { getUserBudgets, getMerchants, getCategories, getTransactions } from '@my-hub/shared/services';

export interface MerchantReportItem {
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

  const [merchants, categories, txns] = await Promise.all([
    getMerchants(user.id, budgetId),
    getCategories(user.id, budgetId),
    getTransactions(user.id, budgetId, { type: 'expense', fromDate, toDate, limit: 2000 }),
  ]);

  const merchantMap = new Map(merchants.map(m => [m.id, m]));
  const categoryMap = new Map(categories.map(c => [c.id, c]));

  // Aggregate by merchantId
  const agg = new Map<
    number,
    { txCount: number; totalSpent: number; lastDate: string; lastCategoryId: number | null }
  >();

  for (const t of txns) {
    if (t.merchantId == null) continue;
    const existing = agg.get(t.merchantId);
    if (!existing) {
      agg.set(t.merchantId, {
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

  const items: MerchantReportItem[] = Array.from(agg.entries())
    .map(([merchantId, stats]) => {
      const merchant = merchantMap.get(merchantId);
      const cat = stats.lastCategoryId != null ? categoryMap.get(stats.lastCategoryId) : undefined;
      return {
        id: merchantId,
        name: merchant?.name ?? '—',
        txCount: stats.txCount,
        totalSpent: Math.round(stats.totalSpent * 100) / 100,
        lastDate: stats.lastDate,
        categoryName: cat?.name ?? null,
        categoryColor: cat?.color ?? null,
        categoryIcon: cat?.icon ?? null,
      };
    })
    .sort((a, b) => b.totalSpent - a.totalSpent);

  return NextResponse.json({ currency: budget.defaultCurrency, merchants: items });
});
