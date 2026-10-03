import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import {
  getUserActiveBudget,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  getPayees,
  upsertPayee,
  syncLabels,
  transferToAmount,
  getOriginalInput,
} from '@my-hub/shared/services';
import type { TransactionUpdate } from '@my-hub/shared/services';
import { FxRateSources, TransactionTypes } from '@my-hub/shared/constants';
import { omitUndefined } from '@my-hub/shared/utils';
import { okResponseSchema } from '../../shared.schema';
import { transactionMoneyInputSchema, transactionMutationResponseSchema, withMoneyInputErrors } from '../route';
import type { TransactionMutationResponse } from '../route';

export const transactionDetailSchema = z.object({
  id: z.number().int(),
  type: z.enum(TransactionTypes),
  accountId: z.number().int(),
  toAccountId: z.number().int().nullable(),
  categoryId: z.number().int().nullable(),
  payeeId: z.number().int().nullable(),
  payeeName: z.string().nullable(),
  /** In the account's currency. */
  amount: z.number(),
  /** Transfers: amount received, in the destination account's currency. */
  toAmount: z.number().nullable(),
  /** Set when the amount was entered in another currency: what the user typed and the rate used. */
  original: z
    .object({
      amount: z.number(),
      currency: z.string(),
      rate: z.number(),
      rateSource: z.enum(FxRateSources).nullable(),
      rateDate: z.string().nullable(),
    })
    .nullable(),
  date: z.string(),
  notes: z.string().nullable(),
  labels: z.array(z.string()),
  isCorrection: z.boolean(),
});

export type TransactionDetail = z.infer<typeof transactionDetailSchema>;
export type { TransactionMutationResponse };

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

const TransactionPatchSchema = transactionMoneyInputSchema.extend({
  type: z.enum(Object.values(TransactionTypes) as [string, ...string[]]).optional(),
  accountId: z.number().int().positive().optional(),
  toAccountId: z.number().int().positive().nullable().optional(),
  amount: z.number().optional(),
  date: z.string().min(1).optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  payeeName: z.string().optional(),
  notes: z.string().optional(),
  labels: z.array(z.string()).optional(),
});

export const GET = route({ params: paramsSchema, response: transactionDetailSchema })(async ({ user, params }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const budgetId = budget.id;
  const [tx, payees] = await Promise.all([
    getTransactionById(user.id, budgetId, params.id),
    getPayees(user.id, budgetId),
  ]);
  if (!tx) routeHttpError(404, { error: 'Transaction not found' });

  const payee = tx.payeeId != null ? payees.find(p => p.id === tx.payeeId) : undefined;

  return {
    id: tx.id,
    type: tx.type,
    accountId: tx.accountId,
    toAccountId: tx.toAccountId ?? null,
    categoryId: tx.categoryId ?? null,
    payeeId: tx.payeeId ?? null,
    payeeName: payee?.name ?? null,
    amount: tx.amount,
    toAmount: tx.type === TransactionTypes.Transfer ? transferToAmount(tx) : null,
    original: getOriginalInput(tx.extras),
    date: tx.date,
    notes: tx.notes ?? null,
    labels: (tx.labels as string[]) ?? [],
    isCorrection: tx.isCorrection,
  };
});

export const PATCH = route({
  params: paramsSchema,
  body: TransactionPatchSchema,
  response: transactionMutationResponseSchema,
})(async ({ user, params, body }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const budgetId = budget.id;
  const existing = await getTransactionById(user.id, budgetId, params.id);
  if (!existing) routeHttpError(404, { error: 'Transaction not found' });

  let payeeId: number | null | undefined = undefined;
  if (body.payeeName !== undefined) {
    if (body.payeeName.trim()) {
      payeeId = (await upsertPayee(user.id, budgetId, body.payeeName.trim())).id;
    } else {
      payeeId = null;
    }
  }

  const update: TransactionUpdate = omitUndefined({
    type: body.type as TransactionUpdate['type'] | undefined,
    accountId: body.accountId,
    toAccountId: body.toAccountId,
    amount: body.amount,
    amountCurrency: body.amountCurrency,
    rate: body.rate,
    toAmount: body.toAmount,
    date: body.date,
    categoryId: body.categoryId,
    payeeId,
    notes: body.notes !== undefined ? body.notes.trim() || null : undefined,
    labels: body.labels,
  });

  const transaction = await withMoneyInputErrors(() => updateTransaction(user.id, budgetId, params.id, update));
  if (body.labels !== undefined && body.labels.length > 0) {
    syncLabels(user.id, budgetId, body.labels).catch(err => console.warn('[finances] label sync failed:', err));
  }
  return { transaction };
});

export const DELETE = route({ params: paramsSchema, response: okResponseSchema })(async ({ user, params }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  await deleteTransaction(user.id, budget.id, params.id);
  return { ok: true as const };
});
