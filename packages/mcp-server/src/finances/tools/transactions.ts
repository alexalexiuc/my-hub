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
  findPayeeByNameOrAlias,
  upsertPayee,
  resolvePayeeIdByNameOrAlias,
  getAccountById,
  getAccounts,
  getCategories,
  getGroups,
  getTransactionById,
  getPayees,
  getBudgetProgress,
} from '@my-hub/shared/services';
import { TransactionTypes } from '@my-hub/shared/constants';
import type { TransactionInsert } from '@my-hub/shared/services';
import { currentDateString, isPayeeRequired, omitUndefined } from '@my-hub/shared/utils';

// ─── add_transactions ─────────────────────────────────────────────────────────

const BaseExtrasSchema = z.object({
  source: z.literal('mcp').optional(),
  autofillConfidence: z.number().min(0).max(1).optional(),
  rawInput: z.string().optional(),
  cardHint: z.string().optional(),
});

const ReceiptLineItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().positive().optional(),
  unit: z.string().optional(),
  unitPrice: z.number().positive().optional(),
  totalPrice: z.number().positive().optional(),
  categoryHint: z.string().optional(),
});

// Optional structured metadata for AI-assisted inserts.
// The server infers kind: receipt when any receipt-specific fields are present,
// otherwise manual.
const TransactionExtrasSchema = BaseExtrasSchema.extend({
  payeeAddress: z.string().optional(),
  receiptNumber: z.string().optional(),
  taxAmount: z.number().optional(),
  tipAmount: z.number().optional(),
  discountAmount: z.number().optional(),
  items: z.array(ReceiptLineItemSchema).optional(),
  extra: z.record(z.string(), z.unknown()).optional(),
});

const TransactionItemSchema = z
  .object({
    type: z.enum(TransactionTypes),
    amount: z.number().positive(),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/)
      .optional(),
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
  })
  .superRefine((item, ctx) => {
    if (item.type === TransactionTypes.Transfer && item.toAccountId == null) {
      ctx.addIssue({
        code: 'custom',
        path: ['toAccountId'],
        message: 'toAccountId is required for transfer transactions',
      });
    }

    if (item.type !== TransactionTypes.Transfer && item.toAccountId != null) {
      ctx.addIssue({
        code: 'custom',
        path: ['toAccountId'],
        message: 'toAccountId can only be set for transfer transactions',
      });
    }
  });

export const AddTransactionsSchema = z.object({
  transactions: z.array(TransactionItemSchema).min(1).max(50),
});

export const addTransactionsTool: ToolHandler<typeof AddTransactionsSchema.shape> = async (input, context) => {
  const { userId } = context;

  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new Error('No active budget. Set an active budget in the Hub first.');

  const results = [];
  let categoryTargetsById: Map<number, number | null> | null = null;

  const getCategoryTargetsById = async (): Promise<Map<number, number | null>> => {
    if (categoryTargetsById == null) {
      const categories = await getCategories(userId, budget.id);
      categoryTargetsById = new Map(categories.map(category => [category.id, category.monthlyTarget ?? null]));
    }

    return categoryTargetsById;
  };

  for (let i = 0; i < input.transactions.length; i++) {
    const item = input.transactions[i]!;

    try {
      const date = item.date ?? currentDateString();

      // Resolve payee (block if not found)
      let payeeId: number | null = null;
      if (isPayeeRequired(item.type) && item.payeeName) {
        const resolvedPayeeId = await resolvePayeeIdByNameOrAlias(userId, budget.id, item.payeeName);
        if (resolvedPayeeId === undefined) {
          return toolResponse({
            error: {
              code: 'payee_not_found',
              message: `Payee not found: ${item.payeeName}`,
              normalizedName: item.payeeName.trim().toLowerCase(),
              requirePayeeCreation: true,
            },
          });
        }

        payeeId = resolvedPayeeId;
      }

      // Duplicate check
      const duplicate = await checkDuplicateTransaction(userId, budget.id, {
        accountId: item.accountId,
        date,
        amount: item.amount,
        payeeId,
      });

      const account = await getAccountById(userId, budget.id, item.accountId);
      if (!account) throw new Error(`Account ${item.accountId} not found`);

      const amountCurrency = item.currency?.toUpperCase();

      const hasReceiptDetails =
        item.extras != null &&
        (item.extras.payeeAddress != null ||
          item.extras.receiptNumber != null ||
          item.extras.taxAmount != null ||
          item.extras.tipAmount != null ||
          item.extras.discountAmount != null ||
          item.extras.items != null);

      const hasBaseDetails =
        item.extras != null &&
        (item.extras.source != null ||
          item.extras.autofillConfidence != null ||
          item.extras.rawInput != null ||
          item.extras.cardHint != null ||
          item.extras.extra != null ||
          amountCurrency != null);

      let inferredExtras: TransactionInsert['extras'] = null;
      if ((item.extras != null && (hasReceiptDetails || hasBaseDetails)) || amountCurrency != null) {
        if (hasReceiptDetails) {
          inferredExtras = omitUndefined({
            kind: 'receipt',
            source: item.extras?.source ?? 'mcp',
            autofillConfidence: item.extras?.autofillConfidence,
            rawInput: item.extras?.rawInput,
            cardHint: item.extras?.cardHint,
            payeeAddress: item.extras?.payeeAddress,
            receiptNumber: item.extras?.receiptNumber,
            taxAmount: item.extras?.taxAmount,
            tipAmount: item.extras?.tipAmount,
            discountAmount: item.extras?.discountAmount,
            items: item.extras?.items,
            extra: item.extras?.extra,
          }) as TransactionInsert['extras'];
        } else {
          inferredExtras = omitUndefined({
            kind: 'manual',
            source: item.extras?.source ?? 'mcp',
            autofillConfidence: item.extras?.autofillConfidence,
            rawInput: item.extras?.rawInput,
            cardHint: item.extras?.cardHint,
            extra: item.extras?.extra,
          }) as TransactionInsert['extras'];
        }
      }

      const txData: TransactionInsert = {
        type: item.type,
        amount: item.amount,
        date,
        accountId: item.accountId,
        toAccountId: item.toAccountId ?? null,
        categoryId: item.categoryId ?? null,
        payeeId,
        notes: item.notes,
        isCorrection: item.isCorrection ?? false,
        source: 'mcp',
        amountCurrency,
        extras: inferredExtras,
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

      if (item.categoryId != null) {
        const targetsById = await getCategoryTargetsById();
        const monthlyTarget = targetsById.get(item.categoryId) ?? null;

        if (monthlyTarget != null) {
          const month = date.slice(0, 7);
          const budgetProgress = await getBudgetProgress(userId, budget.id, month);
          const categoryProgress = budgetProgress.categories.find(category => category.id === item.categoryId);

          if (categoryProgress?.monthlyTarget != null) {
            result.categoryBudgetProgress = {
              month,
              monthlyTarget: categoryProgress.monthlyTarget,
              spentSoFar: categoryProgress.spent,
            };
          }
        }
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
  type: z.enum(TransactionTypes).optional(),
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

  const nextType = input.type ?? existing.type;
  const nextToAccountId = input.toAccountId !== undefined ? input.toAccountId : existing.toAccountId;

  if (nextType === TransactionTypes.Transfer && nextToAccountId == null) {
    throw new Error('Transfer transactions require toAccountId');
  }

  if (nextType !== TransactionTypes.Transfer && input.toAccountId !== undefined) {
    throw new Error('toAccountId can only be set for transfer transactions');
  }

  const toAccountIdForUpdate =
    input.toAccountId !== undefined
      ? input.toAccountId
      : input.type !== undefined && input.type !== TransactionTypes.Transfer
        ? null
        : undefined;

  // Resolve payee if name provided
  let payeeId: number | null | undefined;
  if (!isPayeeRequired(nextType)) {
    payeeId = null;
  } else if (input.payeeName !== undefined) {
    if (input.payeeName.trim()) {
      const payee =
        (await findPayeeByNameOrAlias(userId, budget.id, input.payeeName)) ??
        (await upsertPayee(userId, budget.id, input.payeeName));
      payeeId = payee.id;
    } else {
      payeeId = undefined;
    }
  }

  const updateData = omitUndefined({
    type: input.type,
    amount: input.amount,
    date: input.date,
    accountId: input.accountId,
    toAccountId: toAccountIdForUpdate,
    categoryId: input.categoryId,
    payeeId,
    notes: input.notes,
    isCorrection: input.isCorrection,
  });

  const updated = await updateTransaction(userId, budget.id, input.transactionId, updateData);
  const resolvedAccount = await getAccountById(userId, budget.id, updated.accountId);

  return toolResponse({
    index: 0,
    transactionId: updated.id,
    fromAccountBalanceAfter: updated.fromAccountBalanceAfter,
    ...(updated.toAccountBalanceAfter != null ? { toAccountBalanceAfter: updated.toAccountBalanceAfter } : {}),
    resolvedAccount: resolvedAccount?.name ?? String(updated.accountId),
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
  type: z.enum(TransactionTypes).optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  includeCorrections: z.boolean().optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
});

export const queryTransactionsTool: ToolHandler<typeof QueryTransactionsSchema.shape> = async (input, context) => {
  const { userId } = context;

  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new Error('No active budget.');

  // Resolve payee name to ID if provided
  let payeeId: number | undefined = undefined;
  if (input.payeeName !== undefined) {
    const match = await findPayeeByNameOrAlias(userId, budget.id, input.payeeName);
    if (!match) {
      return toolResponse({ transactions: [], total: 0 });
    }

    payeeId = match.id;
  }

  let categoryId: number | null | undefined = undefined;
  if (input.categoryId !== undefined) categoryId = input.categoryId;

  const opts = {
    accountId: input.accountId,
    categoryId,
    payeeId,
    type: input.type as (typeof TransactionTypes)[keyof typeof TransactionTypes] | undefined,
    fromDate: input.dateFrom,
    toDate: input.dateTo,
    includeCorrections: input.includeCorrections,
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
    getPayees(userId, budget.id),
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
