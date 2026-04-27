import { z } from 'zod';
import { route, routeHttpError, created } from '@/lib/api/route';
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
import { TransactionTypes } from '@my-hub/shared/constants';
const TransactionCreateSchema = z.object({
  type: z.enum(Object.values(TransactionTypes) as [string, ...string[]]),
  accountId: z.number().int().positive(),
  toAccountId: z.number().int().positive().optional(),
  amount: z.number(),
  date: z.string().min(1, 'date is required'),
  categoryId: z.number().int().positive().nullable().optional(),
  payeeName: z.string().optional(),
  notes: z.string().optional(),
  exchangeRate: z.number().optional(),
  isCorrection: z.boolean().optional(),
});

const TransactionQuerySchema = z.object({
  type: z.enum(Object.values(TransactionTypes) as [string, ...string[]]).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

export const GET = route({ query: TransactionQuerySchema })(async ({ user, query }) => {
  const budgets = await getUserBudgets(user.id);
  const budget = budgets[0];
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const budgetId = budget.id;
  const limit = Math.min(query.limit ?? 50, 200);
  const offset = query.offset ?? 0;

  const [accounts, categories, payees, txns] = await Promise.all([
    getAccounts(user.id, budgetId),
    getCategories(user.id, budgetId),
    getPayees(user.id, budgetId),
    getTransactions(user.id, budgetId, {
      type: query.type as 'expense' | 'income' | 'transfer' | undefined,
      limit,
      offset,
    }),
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

  return { transactions: items, currency: budget.defaultCurrency };
});

export const POST = route({ body: TransactionCreateSchema })(async ({ user, body }) => {
  const budgets = await getUserBudgets(user.id);
  const budget = budgets[0];
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const budgetId = budget.id;

  let payeeId: number | null = null;
  if (body.payeeName?.trim()) {
    const payee = await upsertPayee(user.id, budgetId, body.payeeName.trim());
    payeeId = payee.id;
  }

  const data: TransactionInsert = {
    type: body.type as TransactionInsert['type'],
    accountId: body.accountId,
    toAccountId: body.toAccountId ?? null,
    amount: String(body.amount),
    exchangeRate: String(body.exchangeRate ?? 1),
    date: body.date,
    categoryId: body.categoryId ?? null,
    payeeId,
    notes: body.notes?.trim() || null,
    isCorrection: body.isCorrection === true,
    fromAccountBalanceAfter: null,
    toAccountBalanceAfter: null,
    extras: null,
  };

  const transaction = await addTransaction(user.id, budgetId, data);
  return created({ transaction });
});
