import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import {
  getAccountById,
  getAccounts,
  getTransactionListItems,
  updateAccount,
  getUserActiveBudget,
  getLoanBalanceSnapshotForAccount,
} from '@my-hub/shared/services';
import { AccountTypes, TransactionTypes, type BorrowedLentAccountDetails } from '@my-hub/shared/constants';
import type { AccountUpdate } from '@my-hub/shared/services';
import { FinanceAccount } from '@my-hub/shared/types';
import { categoryIconSchema, categoryColorSchema } from '../../shared.schema';
import { accountDetailsSchema, accountItemSchema, accountMutationResponseSchema } from '../route';
import type { AccountItem, AccountMutationResponse } from '../route';

export const accountTransactionSchema = z.object({
  id: z.number().int(),
  date: z.string(),
  amount: z.number(),
  type: z.enum(TransactionTypes),
  notes: z.string().nullable(),
  payeeName: z.string().nullable(),
  categoryName: z.string().nullable(),
  categoryColor: categoryColorSchema,
  categoryIcon: categoryIconSchema,
  balanceAfter: z.number().nullable(),
  isCorrection: z.boolean(),
  accountName: z.string(),
  addedByInitials: z.string().nullable(),
});

export const accountDetailResponseSchema = z.object({
  account: accountItemSchema,
  transactions: z.array(accountTransactionSchema),
});

export type AccountTransaction = z.infer<typeof accountTransactionSchema>;
export type AccountDetailData = z.infer<typeof accountDetailResponseSchema>;
export type { AccountItem, AccountMutationResponse };

const AccountPatchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('settle') }),
  z.object({ action: z.literal('archive') }),
  z.object({ action: z.literal('unarchive') }),
  z.object({
    action: z.literal('edit'),
    name: z.string().trim().min(1),
    description: z.string().trim().nullable().optional(),
    details: accountDetailsSchema.nullable().optional(),
  }),
]);

function flattenAccount(a: FinanceAccount): AccountItem {
  const details = a.details as Record<string, unknown> | null;
  return {
    id: a.id,
    name: a.name,
    description: a.description ?? null,
    type: a.type,
    currency: a.currency,
    balance: a.balance,
    archived: a.archived,
    ...(details ?? {}),
  } as AccountItem;
}

export const GET = route({
  params: z.object({ id: z.coerce.number().int().positive() }),
  response: accountDetailResponseSchema,
})(async ({ user, params }) => {
  const accountId = params.id;

  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const budgetId = budget.id;

  const [rawAccount, txns] = await Promise.all([
    getAccountById(user.id, budgetId, accountId),
    getTransactionListItems(user.id, budgetId, { accountId, limit: 50, includeCorrections: true }),
  ]);

  if (!rawAccount) routeHttpError(404, { error: 'Account not found' });

  let account = flattenAccount(rawAccount);
  if (rawAccount.type === AccountTypes.Loan) {
    const allAccounts = await getAccounts(user.id, budgetId, { includeArchived: true });
    const accountCurrencyById = new Map(allAccounts.map(current => [current.id, current.currency]));
    const loanSnapshot = await getLoanBalanceSnapshotForAccount(user.id, budgetId, rawAccount, { accountCurrencyById });
    if (loanSnapshot) {
      account = {
        ...account,
        balance: loanSnapshot.balance,
        amortizationSummary: loanSnapshot.amortizationSummary,
      };
    }
  }

  const transactions: AccountTransaction[] = txns.map(t => ({
    id: t.id,
    date: t.date,
    amount: t.amount,
    type: t.type,
    notes: t.notes,
    payeeName: t.payeeName,
    categoryName: t.categoryName,
    categoryColor: t.categoryColor,
    categoryIcon: t.categoryIcon,
    balanceAfter: t.accountId === accountId ? t.fromAccountBalanceAfter : t.toAccountBalanceAfter,
    isCorrection: t.isCorrection,
    accountName: t.accountName,
    addedByInitials: t.addedByInitials,
  }));

  return { account, transactions };
});

export const PATCH = route({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: AccountPatchSchema,
  response: accountMutationResponseSchema,
})(async ({ user, params, body }) => {
  const accountId = params.id;

  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const existing = await getAccountById(user.id, budget.id, accountId);
  if (!existing) routeHttpError(404, { error: 'Account not found' });

  if (body.action === 'settle') {
    const currentDetails = (existing.details ?? {}) as BorrowedLentAccountDetails;
    const updated = await updateAccount(user.id, budget.id, accountId, {
      details: { ...currentDetails, settled: true },
      archived: true,
    });
    return { account: updated };
  }

  if (body.action === 'archive') {
    const updated = await updateAccount(user.id, budget.id, accountId, { archived: true });
    return { account: updated };
  }

  if (body.action === 'unarchive') {
    const updated = await updateAccount(user.id, budget.id, accountId, { archived: false });
    return { account: updated };
  }

  if (body.action === 'edit') {
    const patch: AccountUpdate = { name: body.name };
    if (body.description !== undefined) patch.description = body.description ?? null;
    if (body.details !== undefined) patch.details = body.details ?? null;
    const updated = await updateAccount(user.id, budget.id, accountId, patch);
    return { account: updated };
  }

  routeHttpError(400, { error: 'Unknown action' });
});
