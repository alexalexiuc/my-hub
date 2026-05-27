import { HandledError } from '../../shared/errors';
import { z } from 'zod';
import { ToolHandler } from '../../shared/types';
import { toolResponse } from '../../shared/toolsUtils';
import {
  getUserActiveBudget,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactionListItems,
  countTransactions,
  checkDuplicateTransaction,
  findPayeeByNameOrAlias,
  upsertPayee,
  getAccountById,
  getCategories,
  getTransactionById,
  getBudgetProgress,
  syncLabels,
} from '@my-hub/shared/services';
import { TransactionTypes, AccountTypes } from '@my-hub/shared/constants';
import type { TransactionInsert } from '@my-hub/shared/services';
import { currentDateString, isPayeeRequired, omitUndefined, trimOrNull, logger } from '@my-hub/shared/utils';
import { supportedCurrencySchema } from '../../shared/schemas';

function getAccountAvailable(
  acc: { type: string; balance: number; details: unknown } | null | undefined,
): number | null {
  if (!acc) return null;
  if (acc.type === AccountTypes.CreditCard) {
    const creditLimit = (acc.details as { creditLimit?: number } | null)?.creditLimit ?? 0;
    return creditLimit - acc.balance;
  }
  if (acc.type === AccountTypes.Goal) {
    const targetAmount = (acc.details as { targetAmount?: number } | null)?.targetAmount ?? 0;
    return targetAmount - acc.balance;
  }
  return null;
}

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
    currency: supportedCurrencySchema.optional(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    toAccountId: z.number().int().positive().optional(),
    categoryId: z
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        'Optional category ID for this transaction. Supported for all transaction types including transfers. ' +
          'Use finances_list_context to find available category IDs.',
      ),
    payeeName: z.string().min(1).optional(),
    notes: z.string().min(1),
    labels: z.array(z.string().min(1)).optional(),
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
  accountId: z
    .number()
    .int()
    .positive()
    .describe(
      'The account all transactions in this batch are recorded against. ' +
        'Use finances_list_context to find available account IDs.',
    ),
  transactions: z.array(TransactionItemSchema).min(1).max(50),
  createPayee: z
    .boolean()
    .optional()
    .describe(
      'When true, automatically create any payee that cannot be found by name or alias, ' +
        'instead of returning a payee_not_found error. ' +
        'The new payee is created using the exact payeeName provided in the transaction item.',
    ),
});

export const addTransactionsTool: ToolHandler<typeof AddTransactionsSchema.shape> = async (input, context) => {
  const { userId } = context;

  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new HandledError('No active budget. Set an active budget in the Hub first.');

  const account = await getAccountById(userId, budget.id, input.accountId);
  if (!account) throw new HandledError(`Account ${input.accountId} not found`);

  const results: Array<Record<string, unknown>> = [];
  let lastBalanceAfter: number | null = null;
  const categoryMonthsUsed = new Map<number, Set<string>>();
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

      let payeeId: number | null = null;
      const trimmedPayeeName = item.payeeName?.trim();
      if (isPayeeRequired(item.type) && trimmedPayeeName) {
        const resolvedPayee = await findPayeeByNameOrAlias(userId, budget.id, trimmedPayeeName);
        if (resolvedPayee == null) {
          if (input.createPayee) {
            const newPayee = await upsertPayee(userId, budget.id, trimmedPayeeName);
            payeeId = newPayee.id;
          } else {
            return toolResponse({
              error: {
                code: 'payee_not_found',
                message: `Payee not found: ${trimmedPayeeName}`,
                normalizedName: trimmedPayeeName.toLowerCase(),
                requirePayeeCreation: true,
              },
            });
          }
        } else {
          payeeId = resolvedPayee.id;
        }
      }

      const resolvedCategoryId = item.categoryId ?? null;

      const duplicate = await checkDuplicateTransaction(userId, budget.id, {
        accountId: input.accountId,
        date,
        amount: item.amount,
        payeeId,
      });

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

      const labels = item.labels ?? [];
      const tx = await addTransaction(userId, budget.id, {
        type: item.type,
        amount: item.amount,
        date,
        accountId: input.accountId,
        toAccountId: item.toAccountId ?? null,
        categoryId: resolvedCategoryId,
        payeeId,
        notes: item.notes,
        labels,
        isCorrection: item.isCorrection ?? false,
        source: 'mcp',
        amountCurrency,
        extras: inferredExtras,
      });
      if (labels.length > 0) {
        syncLabels(userId, budget.id, labels).catch(err => logger.warn('[finances] label sync failed:', err));
      }

      lastBalanceAfter = tx.fromAccountBalanceAfter;

      if (resolvedCategoryId != null) {
        const month = date.slice(0, 7);
        const existing = categoryMonthsUsed.get(resolvedCategoryId);
        if (existing) existing.add(month);
        else categoryMonthsUsed.set(resolvedCategoryId, new Set([month]));
      }

      const result: Record<string, unknown> = {
        index: i,
        transactionId: tx.id,
        date,
        amount: item.amount,
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

  const finalBalance = lastBalanceAfter ?? account.balance;

  const accountSummary = {
    id: account.id,
    name: account.name,
    balance: finalBalance,
    availableAfter: getAccountAvailable({ type: account.type, balance: finalBalance, details: account.details }),
  };

  const categoryProgress: Array<{
    categoryId: number;
    categoryName: string;
    month: string;
    monthlyTarget: number;
    spentSoFar: number;
    remaining: number;
  }> = [];

  if (categoryMonthsUsed.size > 0) {
    const targetsById = await getCategoryTargetsById();

    const uniqueMonths = new Set<string>();
    for (const [catId, months] of categoryMonthsUsed) {
      if (targetsById.get(catId) != null) {
        for (const month of months) uniqueMonths.add(month);
      }
    }

    const progressByMonth = new Map<string, Awaited<ReturnType<typeof getBudgetProgress>>>();
    await Promise.all(
      Array.from(uniqueMonths).map(async month => {
        progressByMonth.set(month, await getBudgetProgress(userId, budget.id, month));
      }),
    );

    for (const [catId, months] of categoryMonthsUsed) {
      if (targetsById.get(catId) == null) continue;
      for (const month of months) {
        const catProgress = progressByMonth.get(month)?.categories.find(c => c.id === catId);
        if (catProgress?.monthlyTarget == null) continue;
        categoryProgress.push({
          categoryId: catId,
          categoryName: catProgress.name,
          month,
          monthlyTarget: catProgress.monthlyTarget,
          spentSoFar: catProgress.spent,
          remaining: catProgress.monthlyTarget - catProgress.spent,
        });
      }
    }
  }

  return toolResponse({ results, account: accountSummary, categoryProgress });
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
  categoryId: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .describe(
      'Category to assign. Supported for all transaction types including transfers. ' +
        'Pass null to explicitly clear an existing category.',
    ),
  payeeName: z.string().min(1).optional(),
  notes: z.string().min(1).optional(),
  labels: z.array(z.string().min(1)).optional(),
  isCorrection: z.boolean().optional(),
});

export const updateTransactionTool: ToolHandler<typeof UpdateTransactionSchema.shape> = async (input, context) => {
  const { userId } = context;

  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new HandledError('No active budget.');

  // Fetch existing to verify ownership
  const existing = await getTransactionById(userId, budget.id, input.transactionId);
  if (!existing) throw new HandledError('Transaction not found');
  if (existing.addedByUserId !== userId) throw new HandledError('You can only edit your own transactions');

  const nextType = input.type ?? existing.type;
  const nextToAccountId = input.toAccountId !== undefined ? input.toAccountId : existing.toAccountId;

  if (nextType === TransactionTypes.Transfer && nextToAccountId == null) {
    throw new HandledError('Transfer transactions require toAccountId');
  }

  if (nextType !== TransactionTypes.Transfer && input.toAccountId !== undefined) {
    throw new HandledError('toAccountId can only be set for transfer transactions');
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
    labels: input.labels,
    isCorrection: input.isCorrection,
  });

  const updated = await updateTransaction(userId, budget.id, input.transactionId, updateData);
  if (input.labels !== undefined && input.labels.length > 0) {
    syncLabels(userId, budget.id, input.labels).catch(err => logger.warn('[finances] label sync failed:', err));
  }
  const resolvedAccount = await getAccountById(userId, budget.id, updated.accountId);

  const responseData: Record<string, unknown> = {
    index: 0,
    transactionId: updated.id,
    fromAccountBalanceAfter: updated.fromAccountBalanceAfter,
    fromAccountAvailableAfter: getAccountAvailable(resolvedAccount),
    resolvedAccount: resolvedAccount?.name ?? String(updated.accountId),
    resolvedCategory: updated.categoryId != null ? String(updated.categoryId) : null,
    resolvedPayee: input.payeeName ?? null,
  };

  if (updated.toAccountBalanceAfter != null) {
    responseData.toAccountBalanceAfter = updated.toAccountBalanceAfter;
    const toAccount = await getAccountById(userId, budget.id, updated.toAccountId!);
    if (toAccount) {
      responseData.toAccountAvailableAfter = getAccountAvailable(toAccount);
    }
  }

  // Add category budget progress if category is set
  if (updated.categoryId != null) {
    const categories = await getCategories(userId, budget.id);
    const category = categories.find(c => c.id === updated.categoryId);
    if (category?.monthlyTarget != null) {
      const month = updated.date.slice(0, 7);
      const budgetProgress = await getBudgetProgress(userId, budget.id, month);
      const categoryProgress = budgetProgress.categories.find(cp => cp.id === updated.categoryId);
      if (categoryProgress?.monthlyTarget != null) {
        responseData.categoryBudgetProgress = {
          month,
          monthlyTarget: categoryProgress.monthlyTarget,
          spentSoFar: categoryProgress.spent,
          remaining: categoryProgress.monthlyTarget - categoryProgress.spent,
        };
      }
    }
  }

  return toolResponse(responseData);
};

// ─── delete_transaction ───────────────────────────────────────────────────────

export const DeleteTransactionSchema = z.object({
  transactionId: z.number().int().positive(),
});

export const deleteTransactionTool: ToolHandler<typeof DeleteTransactionSchema.shape> = async (input, context) => {
  const { userId } = context;

  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new HandledError('No active budget.');

  const existing = await getTransactionById(userId, budget.id, input.transactionId);
  if (!existing) throw new HandledError('Transaction not found');
  if (existing.addedByUserId !== userId) throw new HandledError('You can only delete your own transactions');

  const result = await deleteTransaction(userId, budget.id, input.transactionId);

  return toolResponse({ deleted: true, accountBalanceAfter: result.accountBalanceAfter });
};

// ─── query_transactions ───────────────────────────────────────────────────────

export const QueryTransactionsSchema = z.object({
  accountId: z.number().int().positive().optional(),
  categoryId: z
    .number()
    .int()
    .positive()
    .optional()
    .nullable()
    .describe('Filter by category. Pass null to find transactions with no category.'),
  payeeName: z
    .string()
    .optional()
    .nullable()
    .describe(
      'Filter by payee name. Performs a case-insensitive partial match against payee names and aliases. Pass null to find transactions with no payee.',
    ),
  label: z.string().optional(),
  type: z.enum(TransactionTypes).optional(),
  fromDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Start date in YYYY-MM-DD format (inclusive). Example: "2024-01-01".'),
  toDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('End date in YYYY-MM-DD format (inclusive). Example: "2024-01-31".'),
  amountGte: z
    .number()
    .optional()
    .describe('Filter transactions with amount greater than or equal to this value (in account currency).'),
  amountLte: z
    .number()
    .optional()
    .describe('Filter transactions with amount less than or equal to this value (in account currency).'),
  includeCorrections: z.boolean().optional(),
  addedByUserId: z.string().optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
  includeExtras: z
    .boolean()
    .optional()
    .describe(
      'When true, include the extras field (structured MCP/AI metadata) on each transaction. Omitted by default to keep responses compact.',
    ),
});

export const queryTransactionsTool: ToolHandler<typeof QueryTransactionsSchema> = async (input, context) => {
  const { userId } = context;

  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new HandledError('No active budget.');

  // Resolve payee name to ID if provided
  let payeeId: number | null | undefined = undefined;
  if (input.payeeName === null) {
    payeeId = null;
  } else {
    const payeeNameTrimmed = trimOrNull(input.payeeName);
    if (payeeNameTrimmed != null) {
      const match = await findPayeeByNameOrAlias(userId, budget.id, payeeNameTrimmed);
      if (!match) return toolResponse({ transactions: [], total: 0 });
      payeeId = match.id;
    }
  }

  const opts = omitUndefined({
    accountId: input.accountId,
    categoryId: input.categoryId,
    payeeId,
    label: input.label,
    type: input.type as (typeof TransactionTypes)[keyof typeof TransactionTypes] | undefined,
    fromDate: input.fromDate,
    toDate: input.toDate,
    amountGte: input.amountGte,
    amountLte: input.amountLte,
    includeCorrections: input.includeCorrections,
    addedByUserId: input.addedByUserId,
    search: input.search,
    limit: input.limit ?? 50,
    offset: input.offset ?? 0,
  });

  const [txns, total] = await Promise.all([
    getTransactionListItems(userId, budget.id, opts),
    countTransactions(userId, budget.id, opts),
  ]);

  const transactions = txns.map(tx => {
    return {
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      date: tx.date,
      notes: tx.notes,
      labels: tx.labels,
      isCorrection: tx.isCorrection,
      account: { id: tx.accountId, name: tx.accountName, currency: tx.accountCurrency },
      ...(tx.toAccountId != null
        ? { toAccount: { id: tx.toAccountId, name: tx.toAccountName, currency: tx.toAccountCurrency } }
        : {}),
      ...(tx.categoryId != null
        ? {
            category: {
              id: tx.categoryId,
              name: tx.categoryName,
              displayName: tx.groupName ? `${tx.groupName} > ${tx.categoryName}` : tx.categoryName,
            },
          }
        : {}),
      ...(tx.payeeId != null ? { payee: { id: tx.payeeId, name: tx.payeeName } } : {}),
      addedByUserId: tx.addedByUserId,
      addedByInitials: tx.addedByInitials,
      createdAt: tx.createdAt,
      fromAccountBalanceAfter: tx.fromAccountBalanceAfter,
      toAccountBalanceAfter: tx.toAccountBalanceAfter,
      ...(input.includeExtras && tx.extras != null ? { extras: tx.extras } : {}),
    };
  });

  return toolResponse({ transactions, total });
};
