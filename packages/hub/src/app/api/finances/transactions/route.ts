import { z } from 'zod';
import { route, routeHttpError, created } from '@/lib/api/route';
import {
  getUserActiveBudget,
  addTransaction,
  upsertPayee,
  getAccounts,
  getCategories,
  getPayees,
  getTransactions,
  getBudgetMembers,
} from '@my-hub/shared/services';
import type { TransactionInsert } from '@my-hub/shared/services';
import { TransactionTypes } from '@my-hub/shared/constants';
import type { TransactionListItem } from '../contracts';
import { transactionsListResponseSchema, transactionMutationResponseSchema } from '../contracts';

function buildUserInitialsMap(members: Awaited<ReturnType<typeof getBudgetMembers>>) {
  return new Map(
    members.map(m => {
      const name = m.name?.trim() || m.email;
      const parts = name.split(/\s+/).filter(Boolean);
      const first = parts[0]?.[0] ?? '';
      const last = parts.length >= 2 ? (parts[parts.length - 1]?.[0] ?? '') : '';
      const initials = parts.length >= 2 ? (first + last).toUpperCase() : name.slice(0, 2).toUpperCase();
      return [m.userId, initials];
    }),
  );
}

function toTransactionListItem(
  transaction: Awaited<ReturnType<typeof addTransaction>>,
  accountMap: Map<number, { name: string }>,
  categoryMap: Map<number, { name: string; color: string | null; icon: string | null }>,
  payeeMap: Map<number, { name: string }>,
  userInitialsMap: Map<string, string>,
): TransactionListItem {
  const category = transaction.categoryId != null ? categoryMap.get(transaction.categoryId) : undefined;
  const payee = transaction.payeeId != null ? payeeMap.get(transaction.payeeId) : undefined;
  const account = accountMap.get(transaction.accountId);
  const toAccount = transaction.toAccountId != null ? accountMap.get(transaction.toAccountId) : undefined;

  return {
    id: transaction.id,
    date: transaction.date,
    amount: transaction.amount,
    type: transaction.type,
    isCorrection: transaction.isCorrection,
    notes: transaction.notes ?? null,
    payeeName: payee?.name ?? null,
    categoryName: category?.name ?? null,
    categoryColor: category?.color ?? null,
    categoryIcon: category?.icon ?? null,
    accountName: account?.name ?? '—',
    toAccountName: toAccount?.name ?? null,
    addedByInitials: userInitialsMap.get(transaction.addedByUserId) ?? null,
  };
}

const TransactionCreateSchema = z.object({
  type: z.enum(Object.values(TransactionTypes) as [string, ...string[]]),
  accountId: z.number().int().positive(),
  toAccountId: z.number().int().positive().nullable().optional(),
  amount: z.number(),
  date: z.string().min(1, 'date is required'),
  categoryId: z.number().int().positive().nullable().optional(),
  payeeName: z.string().optional(),
  notes: z.string().optional(),
  isCorrection: z.boolean().optional(),
});

const TransactionQuerySchema = z.object({
  type: z.enum(TransactionTypes).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

export const GET = route({ query: TransactionQuerySchema, response: transactionsListResponseSchema })(async ({
  user,
  query,
}) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const budgetId = budget.id;
  const limit = Math.min(query.limit ?? 50, 200);
  const offset = query.offset ?? 0;

  const [accounts, categories, payees, txns, members] = await Promise.all([
    getAccounts(user.id, budgetId),
    getCategories(user.id, budgetId),
    getPayees(user.id, budgetId),
    getTransactions(user.id, budgetId, {
      type: query.type,
      includeCorrections: true,
      limit,
      offset,
    }),
    getBudgetMembers(user.id, budgetId),
  ]);

  const accountMap = new Map(accounts.map(account => [account.id, { name: account.name }]));
  const categoryMap = new Map(
    categories.map(category => [
      category.id,
      { name: category.name, color: category.color ?? null, icon: category.icon ?? null },
    ]),
  );
  const payeeMap = new Map(payees.map(payee => [payee.id, { name: payee.name }]));
  const userInitialsMap = buildUserInitialsMap(members);

  const items = txns.map(transaction =>
    toTransactionListItem(transaction, accountMap, categoryMap, payeeMap, userInitialsMap),
  );

  return { transactions: items, currency: budget.defaultCurrency };
});

export const POST = route({ body: TransactionCreateSchema, response: transactionMutationResponseSchema })(async ({
  user,
  body,
}) => {
  const budget = await getUserActiveBudget(user.id);
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
    amount: body.amount,
    date: body.date,
    categoryId: body.categoryId ?? null,
    payeeId,
    notes: body.notes?.trim() || null,
    isCorrection: body.isCorrection === true,
    source: 'hub',
    fromAccountBalanceAfter: null,
    toAccountBalanceAfter: null,
    extras: null,
  };

  const transaction = await addTransaction(user.id, budgetId, data);

  const [accounts, categories, payees, members] = await Promise.all([
    getAccounts(user.id, budgetId),
    getCategories(user.id, budgetId),
    getPayees(user.id, budgetId),
    getBudgetMembers(user.id, budgetId),
  ]);

  const accountMap = new Map(accounts.map(account => [account.id, { name: account.name }]));
  const categoryMap = new Map(
    categories.map(category => [
      category.id,
      { name: category.name, color: category.color ?? null, icon: category.icon ?? null },
    ]),
  );
  const payeeMap = new Map(payees.map(payee => [payee.id, { name: payee.name }]));
  const userInitialsMap = buildUserInitialsMap(members);

  return created({
    transaction,
    listItem: toTransactionListItem(transaction, accountMap, categoryMap, payeeMap, userInitialsMap),
  });
});
