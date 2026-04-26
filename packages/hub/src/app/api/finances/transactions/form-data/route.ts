import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { getUserBudgets, getAccounts, getCategories, getPayees, getTransactions } from '@my-hub/shared/services';

export const GET = withAuth(async ({ user }) => {
  const budgets = await getUserBudgets(user.id);
  const budget = budgets[0];
  if (!budget) return NextResponse.json({ error: 'No budget found' }, { status: 404 });

  const budgetId = budget.id;

  const [accounts, categories, payees, recentTxns] = await Promise.all([
    getAccounts(user.id, budgetId),
    getCategories(user.id, budgetId),
    getPayees(user.id, budgetId),
    getTransactions(user.id, budgetId, { limit: 200 }),
  ]);

  // Build payee suggestions: payeeName (lowercase) → last used categoryId + accountId
  const payeeMap = new Map(payees.map(p => [p.id, p.name]));
  const suggestions: Record<string, { categoryId: number | null; accountId: number }> = {};
  for (const t of recentTxns) {
    if (t.payeeId == null) continue;
    const name = payeeMap.get(t.payeeId);
    if (!name) continue;
    const key = name.toLowerCase();
    if (!suggestions[key]) {
      suggestions[key] = { categoryId: t.categoryId ?? null, accountId: t.accountId };
    }
  }

  return NextResponse.json({
    currency: budget.defaultCurrency,
    accounts: accounts.map(a => ({ id: a.id, name: a.name, type: a.type, currency: a.currency })),
    categories: categories.map(c => ({
      id: c.id,
      name: c.name,
      icon: c.icon ?? null,
      color: c.color ?? null,
      groupId: c.groupId ?? null,
    })),
    payeeSuggestions: suggestions,
  });
});
