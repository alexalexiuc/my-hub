import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import {
  getUserBudgets,
  getAccountById,
  getCategories,
  getMerchants,
  getTransactions,
  updateAccount,
} from '@my-hub/shared/services';
import type { BorrowedLentAccountDetails } from '@my-hub/shared/constants';
import type { AccountItem, AccountDetailData, AccountTransaction } from '@/app/finances/accounts/types';

function flattenAccount(a: NonNullable<Awaited<ReturnType<typeof getAccountById>>>): AccountItem {
  const details = a.details as Record<string, unknown> | null;
  return {
    id: a.id,
    name: a.name,
    type: a.type,
    currency: a.currency,
    balance: parseFloat(a.balance),
    archived: a.archived,
    ...(details ?? {}),
  } as AccountItem;
}

export const GET = withAuth<{ id: string }>(async ({ user, params }) => {
  const accountId = Number((await params).id);
  if (isNaN(accountId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const budgets = await getUserBudgets(user.id);
  const budget = budgets[0];
  if (!budget) return NextResponse.json({ error: 'No budget found' }, { status: 404 });

  const budgetId = budget.id;

  const [rawAccount, categories, merchants, rawTxns] = await Promise.all([
    getAccountById(user.id, budgetId, accountId),
    getCategories(user.id, budgetId),
    getMerchants(user.id, budgetId),
    getTransactions(user.id, budgetId, { accountId, limit: 50, includeCorrections: true }),
  ]);

  if (!rawAccount) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  const account = flattenAccount(rawAccount);
  const categoryMap = new Map(categories.map(c => [c.id, c]));
  const merchantMap = new Map(merchants.map(m => [m.id, m]));

  const transactions: AccountTransaction[] = rawTxns.map(t => {
    const cat = t.categoryId != null ? categoryMap.get(t.categoryId) : undefined;
    const merchant = t.merchantId != null ? merchantMap.get(t.merchantId) : undefined;
    const isSource = t.accountId === accountId;
    const rawBal = isSource ? t.fromAccountBalanceAfter : t.toAccountBalanceAfter;
    return {
      id: t.id,
      date: t.date,
      amount: parseFloat(t.amount),
      type: t.type,
      notes: t.notes ?? null,
      merchantName: merchant?.name ?? null,
      categoryName: cat?.name ?? null,
      categoryColor: cat?.color ?? null,
      categoryIcon: cat?.icon ?? null,
      balanceAfter: rawBal != null ? parseFloat(rawBal) : null,
      isCorrection: t.isCorrection,
    };
  });

  const data: AccountDetailData = { account, transactions };
  return NextResponse.json(data);
});

export const PATCH = withAuth<{ id: string }>(async ({ req, user, params }) => {
  const accountId = Number((await params).id);
  if (isNaN(accountId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const budgets = await getUserBudgets(user.id);
  const budget = budgets[0];
  if (!budget) return NextResponse.json({ error: 'No budget found' }, { status: 404 });

  const existing = await getAccountById(user.id, budget.id, accountId);
  if (!existing) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  const { action } = body as { action?: string };

  if (action === 'settle') {
    const currentDetails = (existing.details ?? {}) as BorrowedLentAccountDetails;
    const updated = await updateAccount(user.id, budget.id, accountId, {
      details: { ...currentDetails, settled: true },
    });
    return NextResponse.json({ account: updated });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
});
