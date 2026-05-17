import { z } from 'zod';
import { route, routeHttpError, created } from '@/lib/api/route';
import {
  getUserActiveBudget,
  addTransaction,
  upsertPayee,
  getTransactionListItems,
  getTransactionListItemById,
  syncLabels,
} from '@my-hub/shared/services';
import type { TransactionInsert } from '@my-hub/shared/services';
import { TransactionTypes } from '@my-hub/shared/constants';
import { isPayeeRequired } from '@my-hub/shared/utils';
import { supportedCurrencySchema } from '../currency.schema';
import { categoryIconSchema, categoryColorSchema } from '../shared.schema';

export const transactionListItemSchema = z.object({
  id: z.number().int(),
  date: z.string(),
  amount: z.number(),
  type: z.enum(TransactionTypes),
  isCorrection: z.boolean(),
  notes: z.string().nullable(),
  labels: z.array(z.string()),
  payeeName: z.string().nullable(),
  categoryName: z.string().nullable(),
  categoryColor: categoryColorSchema,
  categoryIcon: categoryIconSchema,
  accountName: z.string(),
  toAccountName: z.string().nullable(),
  addedByInitials: z.string().nullable(),
});

export const transactionsListResponseSchema = z.object({
  transactions: z.array(transactionListItemSchema),
  currency: supportedCurrencySchema,
});

export const transactionMutationResponseSchema = z.object({
  transaction: z.object({ id: z.number().int() }).loose(),
  listItem: transactionListItemSchema.optional(),
});

export type TransactionListItem = z.infer<typeof transactionListItemSchema>;
export type TransactionsListResponse = z.infer<typeof transactionsListResponseSchema>;
export type TransactionMutationResponse = z.infer<typeof transactionMutationResponseSchema>;

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
  labels: z.array(z.string()).optional(),
});

const TransactionQuerySchema = z.object({
  type: z.enum(TransactionTypes).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  accountId: z.coerce.number().int().positive().optional(),
  payeeId: z.coerce.number().int().positive().optional(),
  label: z.string().optional(),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
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

  const fromDate = query.month ? `${query.month}-01` : undefined;
  let toDate: string | undefined;
  if (query.month) {
    const [y, m] = query.month.split('-').map(Number);
    // first of next month − 1 day = last day of this month
    toDate = new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10);
  }

  const transactions = await getTransactionListItems(user.id, budgetId, {
    type: query.type,
    categoryId: query.categoryId,
    accountId: query.accountId,
    payeeId: query.payeeId,
    label: query.label,
    fromDate,
    toDate,
    includeCorrections: true,
    limit,
    offset,
  });

  return { transactions, currency: budget.defaultCurrency };
});

export const POST = route({ body: TransactionCreateSchema, response: transactionMutationResponseSchema })(async ({
  user,
  body,
}) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const budgetId = budget.id;

  let payeeId: number | null = null;
  if (isPayeeRequired(body.type as TransactionInsert['type']) && body.payeeName?.trim()) {
    payeeId = (await upsertPayee(user.id, budgetId, body.payeeName.trim())).id;
  }

  const labels = body.labels ?? [];

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
    labels,
    source: 'hub',
    fromAccountBalanceAfter: null,
    toAccountBalanceAfter: null,
    extras: null,
  };

  const transaction = await addTransaction(user.id, budgetId, data);
  if (labels.length > 0) {
    syncLabels(user.id, budgetId, labels).catch(err => console.warn('[finances] label sync failed:', err));
  }
  const listItem = (await getTransactionListItemById(user.id, budgetId, transaction.id)) ?? undefined;

  return created({ transaction, listItem });
});
