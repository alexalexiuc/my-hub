import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import {
  getUserBudgets,
  addTransaction,
  upsertPayee,
  getAccounts,
  getCategories,
  getPayees,
  getTransactions,
} from '@my-hub/shared/services';
import type { TransactionInsert } from '@my-hub/shared/services';

export const GET = withAuth(async ({ req, user }) => {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') as 'expense' | 'income' | 'transfer' | null;
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200);
  const offset = Number(searchParams.get('offset') ?? 0);

  const budgets = await getUserBudgets(user.id);
  const budget = budgets[0];
  if (!budget) return NextResponse.json({ error: 'No budget found' }, { status: 404 });

  const budgetId = budget.id;

  const [accounts, categories, payees, txns] = await Promise.all([
    getAccounts(user.id, budgetId),
    getCategories(user.id, budgetId),
    getPayees(user.id, budgetId),
    getTransactions(user.id, budgetId, { type: type ?? undefined, limit, offset }),
  ]);

  const accountMap = new Map(accounts.map(a => [a.id, a]));
  const categoryMap = new Map(categories.map(c => [c.id, c]));
  const payeeMap = new Map(payees.map(p => [p.id, p]));

  const items = txns.map(t => {
    const cat = t.categoryId != null ? categoryMap.get(t.categoryId) : undefined;
    const payee = t.payeeId != null ? payeeMap.get(t.payeeId) : undefined;
    const account = accountMap.get(t.accountId);
    const toAccount = t.toAccountId != null ? accountMap.get(t.toAccountId) : undefined;
    return {
      id: t.id,
      date: t.date,
      amount: parseFloat(t.amount),
      type: t.type,
      notes: t.notes ?? null,
      payeeName: payee?.name ?? null,
      categoryName: cat?.name ?? null,
      categoryColor: cat?.color ?? null,
      categoryIcon: cat?.icon ?? null,
      accountName: account?.name ?? '—',
      toAccountName: toAccount?.name ?? null,
    };
  });

  return NextResponse.json({ transactions: items, currency: budget.defaultCurrency });
});

export const POST = withAuth(async ({ req, user }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { type, accountId, toAccountId, amount, date, categoryId, payeeName, notes, exchangeRate, isCorrection } =
    body as {
      type?: string;
      accountId?: number;
      toAccountId?: number;
      amount?: number;
      date?: string;
      categoryId?: number | null;
      payeeName?: string;
      notes?: string;
      exchangeRate?: number;
      isCorrection?: boolean;
    };

  if (!type || !accountId || amount == null || !date) {
    return NextResponse.json({ error: 'type, accountId, amount, date are required' }, { status: 400 });
  }

  const budgets = await getUserBudgets(user.id);
  const budget = budgets[0];
  if (!budget) return NextResponse.json({ error: 'No budget found' }, { status: 404 });

  const budgetId = budget.id;

  let payeeId: number | null = null;
  if (payeeName?.trim()) {
    const payee = await upsertPayee(user.id, budgetId, payeeName.trim());
    payeeId = payee.id;
  }

  const data: TransactionInsert = {
    type: type as TransactionInsert['type'],
    accountId,
    toAccountId: toAccountId ?? null,
    amount: String(amount),
    exchangeRate: String(exchangeRate ?? 1),
    date,
    categoryId: categoryId ?? null,
    payeeId,
    notes: notes?.trim() || null,
    isCorrection: isCorrection === true,
    fromAccountBalanceAfter: null,
    toAccountBalanceAfter: null,
    extras: null,
  };

  const transaction = await addTransaction(user.id, budgetId, data);
  return NextResponse.json({ transaction }, { status: 201 });
});
