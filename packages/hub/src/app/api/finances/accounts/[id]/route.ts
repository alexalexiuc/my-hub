import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import {
  getAccountById,
  getAccounts,
  getTransactionListItems,
  getTransactions,
  addTransaction,
  deleteTransaction,
  updateAccount,
  setAccountAvailableInclusion,
  getAvailabilityPreferences,
  isIncludedInAvailable,
  getUserActiveBudget,
  getLoanBalanceSnapshotForAccount,
  getLoanDisplayBalance,
} from '@my-hub/shared/services';
import { AccountTypes, TransactionTypes, type BorrowedLentAccountDetails } from '@my-hub/shared/constants';
import type { LoanAccountDetails } from '@my-hub/shared/types';
import type { AccountUpdate } from '@my-hub/shared/services';
import { FinanceAccount } from '@my-hub/shared/types';
import { categoryIconSchema, categoryColorSchema } from '../../shared.schema';
import { accountDetailsSchema, accountItemSchema, accountMutationResponseSchema } from '../route';
import type { AccountItem } from '../route';

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
  toAccountName: z.string().nullable(),
  addedByInitials: z.string().nullable(),
});

export const accountDetailResponseSchema = z.object({
  account: accountItemSchema,
  transactions: z.array(accountTransactionSchema),
  hasInitialBalanceTx: z.boolean().optional(),
});

export type AccountTransaction = z.infer<typeof accountTransactionSchema>;
export type AccountDetailData = z.infer<typeof accountDetailResponseSchema>;

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
  z.object({ action: z.literal('setAvailableInclusion'), include: z.boolean() }),
  z.object({ action: z.literal('setWidgetVisibility'), show: z.boolean() }),
  z.object({ action: z.literal('recreateInitialBalance') }),
]);

function flattenAccount(a: FinanceAccount, includedInAvailable: boolean): AccountItem {
  const details = a.details as Record<string, unknown> | null;
  return {
    id: a.id,
    name: a.name,
    description: a.description ?? null,
    type: a.type,
    currency: a.currency,
    balance: a.balance,
    archived: a.archived,
    includedInAvailable,
    showOnWidget: a.showOnWidget,
    widgetSortOrder: a.widgetSortOrder,
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

  const [rawAccount, txns, prefs] = await Promise.all([
    getAccountById(user.id, budgetId, accountId),
    getTransactionListItems(user.id, budgetId, { accountId, limit: 50, includeCorrections: true }),
    getAvailabilityPreferences(user.id, budgetId),
  ]);

  if (!rawAccount) routeHttpError(404, { error: 'Account not found' });

  let account = flattenAccount(rawAccount, isIncludedInAvailable(rawAccount.type, prefs.get(accountId) ?? null));
  let hasInitialBalanceTx: boolean | undefined;

  if (rawAccount.type === AccountTypes.Loan) {
    const [allAccounts, correctionTxs] = await Promise.all([
      getAccounts(user.id, budgetId, { includeArchived: true }),
      getTransactions(user.id, budgetId, { accountId, includeCorrections: true, type: TransactionTypes.Expense }),
    ]);
    hasInitialBalanceTx = correctionTxs.some(t => t.isCorrection && t.notes === 'Initial Balance');
    const accountCurrencyById = new Map(allAccounts.map(current => [current.id, current.currency]));
    const loanSnapshot = await getLoanBalanceSnapshotForAccount(user.id, budgetId, rawAccount, { accountCurrencyById });
    if (loanSnapshot) {
      account = {
        ...account,
        balance: getLoanDisplayBalance(rawAccount, loanSnapshot),
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
    toAccountName: t.toAccountName,
    addedByInitials: t.addedByInitials,
  }));

  return { account, transactions, hasInitialBalanceTx };
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

  // setAvailableInclusion knows the new inclusion state from body.include — no need to query overrides
  if (body.action === 'setAvailableInclusion') {
    await setAccountAvailableInclusion(user.id, budget.id, accountId, body.include);
    return { account: flattenAccount(existing, body.include) };
  }

  // All other actions need the current inclusion state for the response
  const prefs = await getAvailabilityPreferences(user.id, budget.id);
  const currentIncluded = isIncludedInAvailable(existing.type, prefs.get(accountId) ?? null);

  if (body.action === 'setWidgetVisibility') {
    if (existing.type !== AccountTypes.Loan) routeHttpError(400, { error: 'Only supported for loan accounts' });
    const updated = await updateAccount(user.id, budget.id, accountId, { showOnWidget: body.show });
    return { account: flattenAccount(updated, currentIncluded) };
  }

  if (body.action === 'settle') {
    const currentDetails = (existing.details ?? {}) as BorrowedLentAccountDetails;
    const updated = await updateAccount(user.id, budget.id, accountId, {
      details: { ...currentDetails, settled: true },
      archived: true,
    });
    return { account: flattenAccount(updated, currentIncluded) };
  }

  if (body.action === 'archive') {
    const updated = await updateAccount(user.id, budget.id, accountId, { archived: true });
    return { account: flattenAccount(updated, currentIncluded) };
  }

  if (body.action === 'unarchive') {
    const updated = await updateAccount(user.id, budget.id, accountId, { archived: false });
    return { account: flattenAccount(updated, currentIncluded) };
  }

  if (body.action === 'edit') {
    const patch: AccountUpdate = { name: body.name };
    if (body.description !== undefined) patch.description = body.description ?? null;
    if (body.details !== undefined) patch.details = body.details ?? null;
    const updated = await updateAccount(user.id, budget.id, accountId, patch);
    return { account: flattenAccount(updated, currentIncluded) };
  }

  if (body.action === 'recreateInitialBalance') {
    if (existing.type !== AccountTypes.Loan) routeHttpError(400, { error: 'Only supported for loan accounts' });
    const details = existing.details as LoanAccountDetails | null;
    if (!details?.principal || !details?.firstPaymentDate) {
      routeHttpError(400, { error: 'Loan is missing principal or firstPaymentDate in details' });
    }

    const allTxs = await getTransactions(user.id, budget.id, { accountId, includeCorrections: true });
    const existingInitial = allTxs.filter(t => t.isCorrection && t.notes === 'Initial Balance');
    await Promise.all(existingInitial.map(t => deleteTransaction(user.id, budget.id, t.id)));

    await addTransaction(user.id, budget.id, {
      type: TransactionTypes.Expense,
      accountId,
      toAccountId: null,
      amount: details.principal,
      exchangeRate: 1,
      date: details.firstPaymentDate,
      categoryId: null,
      payeeId: null,
      notes: 'Initial Balance',
      isCorrection: true,
      fromAccountBalanceAfter: null,
      toAccountBalanceAfter: null,
      extras: null,
    });

    return { account: flattenAccount(existing, currentIncluded) };
  }

  routeHttpError(400, { error: 'Unknown action' });
});
