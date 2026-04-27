import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import {
  getAccountById,
  getCategories,
  getPayees,
  getTransactions,
  updateAccount,
  getUserActiveBudget,
} from '@my-hub/shared/services';
import type { BorrowedLentAccountDetails } from '@my-hub/shared/constants';
import type { AccountItem, AccountDetailData, AccountTransaction } from '@/app/finances/accounts/types';
const AccountPatchSchema = z.object({
  action: z.literal('settle'),
});

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

export const GET = route({ params: z.object({ id: z.coerce.number().int().positive() }) })(async ({ user, params }) => {
  const accountId = params.id;

  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const budgetId = budget.id;

  const [rawAccount, categories, payees, rawTxns] = await Promise.all([
    getAccountById(user.id, budgetId, accountId),
    getCategories(user.id, budgetId),
    getPayees(user.id, budgetId),
    getTransactions(user.id, budgetId, { accountId, limit: 50, includeCorrections: true }),
  ]);

  if (!rawAccount) routeHttpError(404, { error: 'Account not found' });

  const account = flattenAccount(rawAccount);
  const categoryMap = new Map(categories.map(c => [c.id, c]));
  const payeeMap = new Map(payees.map(p => [p.id, p]));

  const transactions: AccountTransaction[] = rawTxns.map(t => {
    const cat = t.categoryId != null ? categoryMap.get(t.categoryId) : undefined;
    const payee = t.payeeId != null ? payeeMap.get(t.payeeId) : undefined;
    const isSource = t.accountId === accountId;
    const rawBal = isSource ? t.fromAccountBalanceAfter : t.toAccountBalanceAfter;
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
      balanceAfter: rawBal != null ? parseFloat(rawBal) : null,
      isCorrection: t.isCorrection,
    };
  });

  const data: AccountDetailData = { account, transactions };
  return data;
});

export const PATCH = route({ params: z.object({ id: z.coerce.number().int().positive() }), body: AccountPatchSchema })(
  async ({ user, params, body }) => {
    const accountId = params.id;

    const budget = await getUserActiveBudget(user.id);
    if (!budget) routeHttpError(404, { error: 'No budget found' });

    const existing = await getAccountById(user.id, budget.id, accountId);
    if (!existing) routeHttpError(404, { error: 'Account not found' });

    if (body.action === 'settle') {
      const currentDetails = (existing.details ?? {}) as BorrowedLentAccountDetails;
      const updated = await updateAccount(user.id, budget.id, accountId, {
        details: { ...currentDetails, settled: true },
      });
      return { account: updated };
    }

    routeHttpError(400, { error: 'Unknown action' });
  },
);
