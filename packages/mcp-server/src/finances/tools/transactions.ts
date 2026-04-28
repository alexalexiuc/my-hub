import { z } from 'zod';
import { ToolHandler } from '../../shared/types';
import { toolResponse } from '../../shared/toolsUtils';
import {
  getUserActiveBudget,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactions,
  countTransactions,
  checkDuplicateTransaction,
  upsertPayee,
  getAccountById,
  getAccounts,
  getCategories,
  getGroups,
  getTransactionById,
  getPayeesWithDescription,
  getCurrencyRate,
} from '@my-hub/shared/services';
import { TransactionTypes } from '@my-hub/shared/constants';
import type { TransactionInsert } from '@my-hub/shared/services';
import { currentDateString } from '@my-hub/shared/utils';

// ─── add_transactions ─────────────────────────────────────────────────────────

const TransactionExtrasSchema = z.object({
  source: z.literal('mcp').optional(),
  autofillConfidence: z.number().min(0).max(1).optional(),
  rawInput: z.string().optional(),
  cardHint: z.string().optional(),
});

const TransactionItemSchema = z.object({
  type: z.enum(['expense', 'income', 'transfer']),
  amount: z.number().positive(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  accountId: z.number().int().positive(),
  toAccountId: z.number().int().positive().optional(),
  categoryId: z.number().int().positive().optional(),
  payeeName: z.string().min(1).optional(),
  notes: z.string().min(1),
  isCorrection: z.boolean().optional(),
  extras: TransactionExtrasSchema.optional(),
});

export const AddTransactionsSchema = z.object({
  transactions: z.array(TransactionItemSchema).min(1).max(50),
});

export const addTransactionsTool: ToolHandler<typeof AddTransactionsSchema.shape> = async (input, context) => {
  const { userId } = context;

  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new Error('No active budget. Set an active budget in the Hub first.');

  const results = [];

  for (let i = 0; i < input.transactions.length; i++) {
    const item = input.transactions[i]!;

    try {
      const date = item.date ?? currentDateString();

      // Resolve payee
      let payeeId: number | null = null;
      if (item.payeeName) {
        const payee = await upsertPayee(userId, budget.id, item.payeeName);
        payeeId = payee.id;
      }

      // Duplicate check
      const duplicate = await checkDuplicateTransaction(userId, budget.id, {
        accountId: item.accountId,
        date,
        amount: String(item.amount),
        payeeId,
      });

      // Resolve exchange rate when account currency != budget default currency
      const account = await getAccountById(userId, budget.id, item.accountId);
      if (!account) throw new Error(`Account ${item.accountId} not found`);

      const exchangeRate =
        account.currency !== budget.defaultCurrency
          ? await getCurrencyRate(account.currency, budget.defaultCurrency, date)
          : 1;

      const txData: TransactionInsert = {
        type: item.type,
        amount: String(item.amount),
        date,
        accountId: item.accountId,
        toAccountId: item.toAccountId ?? null,
        categoryId: item.categoryId ?? null,
        payeeId,
        notes: item.notes,
        isCorrection: item.isCorrection ?? false,
        exchangeRate: String(exchangeRate),
        extras: item.extras
          ? {
              kind: 'base',
              source: item.extras.source ?? 'mcp',
              autofillConfidence: item.extras.autofillConfidence,
              rawInput: item.extras.rawInput,
              cardHint: item.extras.cardHint,
            }
          : { kind: 'base', source: 'mcp' },
      };

      const tx = await addTransaction(userId, budget.id, txData);

      const result: Record<string, unknown> = {
        index: i,
        transactionId: tx.id,
        fromAccountBalanceAfter: tx.fromAccountBalanceAfter,
        resolvedAccount: account.name,
        resolvedCategory: item.categoryId != null ? String(item.categoryId) : null,
        resolvedPayee: item.payeeName ?? null,
      };

      if (tx.toAccountBalanceAfter != null) {
        result.toAccountBalanceAfter = tx.toAccountBalanceAfter;
      }

      if (duplicate) {
        result.duplicate = {
          warning: 'possible_duplicate',
          matchedTransactionId: duplicate.id,
          matchedDate: duplicate.date,
          matchedAmount: duplicate.amount,
          matchedPayee: item.payeeName ?? null,
        };
      }

      results.push(result);
    } catch (err) {
      results.push({
        index: i,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return toolResponse({ results });
};

// ─── update_transaction ───────────────────────────────────────────────────────

export const UpdateTransactionSchema = z.object({
  transactionId: z.number().int().positive(),
  amount: z.number().positive().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  accountId: z.number().int().positive().optional(),
  toAccountId: z.number().int().positive().optional(),
  categoryId: z.number().int().positive().optional(),
  payeeName: z.string().min(1).optional(),
  notes: z.string().min(1).optional(),
  isCorrection: z.boolean().optional(),
});

export const updateTransactionTool: ToolHandler<typeof UpdateTransactionSchema.shape> = async (input, context) => {
  const { userId } = context;

  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new Error('No active budget.');

  // Fetch existing to verify ownership
  const existing = await getTransactionById(userId, budget.id, input.transactionId);
  if (!existing) throw new Error('Transaction not found');
  if (existing.addedByUserId !== userId) throw new Error('You can only edit your own transactions');

  // Resolve payee if name provided
  let payeeId: number | undefined;
  if (input.payeeName !== undefined) {
    const payee = await upsertPayee(userId, budget.id, input.payeeName);
    payeeId = payee.id;
  }

  const updateData = {
    ...(input.amount !== undefined ? { amount: String(input.amount) } : {}),
    ...(input.date !== undefined ? { date: input.date } : {}),
    ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
    ...(input.toAccountId !== undefined ? { toAccountId: input.toAccountId } : {}),
    ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
    ...(payeeId !== undefined ? { payeeId } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.isCorrection !== undefined ? { isCorrection: input.isCorrection } : {}),
  };

  const updated = await updateTransaction(userId, budget.id, input.transactionId, updateData);

  return toolResponse({
    index: 0,
    transactionId: updated.id,
    fromAccountBalanceAfter: updated.fromAccountBalanceAfter,
    ...(updated.toAccountBalanceAfter != null ? { toAccountBalanceAfter: updated.toAccountBalanceAfter } : {}),
    resolvedAccount: String(updated.accountId),
    resolvedCategory: updated.categoryId != null ? String(updated.categoryId) : null,
    resolvedPayee: input.payeeName ?? null,
  });
};

// ─── delete_transaction ───────────────────────────────────────────────────────

export const DeleteTransactionSchema = z.object({
  transactionId: z.number().int().positive(),
});

export const deleteTransactionTool: ToolHandler<typeof DeleteTransactionSchema.shape> = async (input, context) => {
  const { userId } = context;

  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new Error('No active budget.');

  const existing = await getTransactionById(userId, budget.id, input.transactionId);
  if (!existing) throw new Error('Transaction not found');
  if (existing.addedByUserId !== userId) throw new Error('You can only delete your own transactions');

  const result = await deleteTransaction(userId, budget.id, input.transactionId);

  return toolResponse({ deleted: true, accountBalanceAfter: result.accountBalanceAfter });
};

// ─── query_transactions ───────────────────────────────────────────────────────

export const QueryTransactionsSchema = z.object({
  accountId: z.number().int().positive().optional(),
  categoryId: z.number().int().positive().optional(),
  payeeName: z.string().optional(),
  type: z.enum(['expense', 'income', 'transfer']).optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  isCorrection: z.boolean().optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
});

export const queryTransactionsTool: ToolHandler<typeof QueryTransactionsSchema.shape> = async (input, context) => {
  const { userId } = context;

  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new Error('No active budget.');

  // Resolve payee name to ID if provided
  let categoryId: number | null | undefined = undefined;
  if (input.categoryId !== undefined) categoryId = input.categoryId;

  const opts = {
    accountId: input.accountId,
    categoryId,
    type: input.type as (typeof TransactionTypes)[keyof typeof TransactionTypes] | undefined,
    fromDate: input.dateFrom,
    toDate: input.dateTo,
    includeCorrections: input.isCorrection,
    search: input.search,
    limit: input.limit ?? 50,
    offset: input.offset ?? 0,
  };

  const [txns, total] = await Promise.all([
    getTransactions(userId, budget.id, opts),
    countTransactions(userId, budget.id, opts),
  ]);

  // Fetch related entities for inline resolution
  const [accounts, categories, payees] = await Promise.all([
    getAccounts(userId, budget.id, { includeArchived: true }),
    getCategories(userId, budget.id),
    getPayeesWithDescription(userId, budget.id),
  ]);

  const accountMap = new Map(accounts.map(a => [a.id, a]));
  const categoryMap = new Map(categories.map(c => [c.id, c]));
  const payeeMap = new Map(payees.map(p => [p.id, p]));

  // Get groups for category displayName
  const groups = await getGroups(userId, budget.id);
  const groupMap = new Map(groups.map(g => [g.id, g.name]));

  const transactions = txns.map(tx => {
    const fromAcct = accountMap.get(tx.accountId);
    const toAcct = tx.toAccountId != null ? accountMap.get(tx.toAccountId) : null;
    const cat = tx.categoryId != null ? categoryMap.get(tx.categoryId) : null;
    const payee = tx.payeeId != null ? payeeMap.get(tx.payeeId) : null;
    const groupName = cat?.groupId ? groupMap.get(cat.groupId) : null;

    return {
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      date: tx.date,
      notes: tx.notes,
      isCorrection: tx.isCorrection,
      account: fromAcct ? { id: fromAcct.id, name: fromAcct.name, currency: fromAcct.currency } : null,
      ...(toAcct ? { toAccount: { id: toAcct.id, name: toAcct.name, currency: toAcct.currency } } : {}),
      ...(cat
        ? {
            category: {
              id: cat.id,
              name: cat.name,
              displayName: groupName ? `${groupName} > ${cat.name}` : cat.name,
            },
          }
        : {}),
      ...(payee ? { payee: { id: payee.id, name: payee.name } } : {}),
      addedByUserId: tx.addedByUserId,
      fromAccountBalanceAfter: tx.fromAccountBalanceAfter,
      createdAt: tx.createdAt,
    };
  });

  return toolResponse({ transactions, total });
};
