/**
 * Finance transaction CRUD
 * - addTransaction(userId, budgetId, data) — inserts a transaction; updates account balances and payee stats
 * - getTransactions(userId, budgetId, opts?) — lists transactions with optional filters (date range, account, category, type)
 * - getTransactionById(userId, budgetId, transactionId) — single transaction with access check
 * - updateTransaction(userId, budgetId, transactionId, data) — partial update; adjusts payee stats when payeeId changes
 * - deleteTransaction(userId, budgetId, transactionId) — hard delete; decrements payee stats
 * Types: TransactionInsert, TransactionUpdate, GetTransactionsOpts
 */
import { and, desc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { db } from '../../db/client';
import { financeAccounts, financeTransactions } from '../../db/schema/finances';
import { omitNullish } from '../../utils';
import { verifyBudgetAccess } from './budgets';
import { incrementPayeeStats, decrementPayeeStats } from './payees';
import type { FinanceTransaction, NewFinanceTransaction } from '../../types';
import { TransactionTypes, type TransactionType } from '../../constants/finances';

export type TransactionInsert = Omit<
  NewFinanceTransaction,
  'id' | 'budgetId' | 'addedByUserId' | 'createdAt' | 'updatedAt'
>;
export type TransactionUpdate = Partial<
  Pick<
    TransactionInsert,
    | 'type'
    | 'accountId'
    | 'toAccountId'
    | 'amount'
    | 'exchangeRate'
    | 'date'
    | 'categoryId'
    | 'payeeId'
    | 'notes'
    | 'extras'
    | 'isCorrection'
    | 'fromAccountBalanceAfter'
    | 'toAccountBalanceAfter'
  >
>;

export interface GetTransactionsOpts {
  accountId?: number;
  categoryId?: number | null;
  type?: TransactionType;
  fromDate?: string;
  toDate?: string;
  includeCorrections?: boolean;
  limit?: number;
  offset?: number;
}

export async function addTransaction(
  userId: string,
  budgetId: number,
  data: TransactionInsert,
): Promise<FinanceTransaction> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const amt = parseFloat(data.amount);

  return db.transaction(async tx => {
    const [fromAccount] = await tx
      .select({ balance: financeAccounts.balance })
      .from(financeAccounts)
      .where(and(eq(financeAccounts.id, data.accountId), eq(financeAccounts.budgetId, budgetId)));

    if (!fromAccount) throw new Error('Account not found');

    const fromBalanceAfter =
      data.type === TransactionTypes.Income
        ? parseFloat(fromAccount.balance) + amt
        : parseFloat(fromAccount.balance) - amt;

    await tx
      .update(financeAccounts)
      .set({ balance: String(fromBalanceAfter), updatedAt: new Date() })
      .where(and(eq(financeAccounts.id, data.accountId), eq(financeAccounts.budgetId, budgetId)));

    let toBalanceAfter: number | null = null;

    if (data.type === TransactionTypes.Transfer && data.toAccountId != null) {
      const [toAccount] = await tx
        .select({ balance: financeAccounts.balance })
        .from(financeAccounts)
        .where(and(eq(financeAccounts.id, data.toAccountId), eq(financeAccounts.budgetId, budgetId)));

      if (!toAccount) throw new Error('Destination account not found');

      const exchangeRate = parseFloat(data.exchangeRate ?? '1');
      toBalanceAfter = parseFloat(toAccount.balance) + amt * exchangeRate;

      await tx
        .update(financeAccounts)
        .set({ balance: String(toBalanceAfter), updatedAt: new Date() })
        .where(and(eq(financeAccounts.id, data.toAccountId), eq(financeAccounts.budgetId, budgetId)));
    }

    const [row] = await tx
      .insert(financeTransactions)
      .values({
        ...data,
        budgetId,
        addedByUserId: userId,
        fromAccountBalanceAfter: String(fromBalanceAfter),
        toAccountBalanceAfter: toBalanceAfter != null ? String(toBalanceAfter) : null,
      })
      .returning();

    if (!row) throw new Error('Insert did not return a row');

    if (data.payeeId != null) {
      await incrementPayeeStats(tx, data.payeeId, userId, data.categoryId ?? null);
    }

    return row;
  });
}

export async function getTransactions(
  userId: string,
  budgetId: number,
  opts: GetTransactionsOpts = {},
): Promise<FinanceTransaction[]> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const conditions = [eq(financeTransactions.budgetId, budgetId)];

  if (opts.accountId !== undefined) {
    conditions.push(
      or(eq(financeTransactions.accountId, opts.accountId), eq(financeTransactions.toAccountId, opts.accountId))!,
    );
  }
  if (opts.categoryId === null) {
    conditions.push(isNull(financeTransactions.categoryId));
  } else if (opts.categoryId !== undefined) {
    conditions.push(eq(financeTransactions.categoryId, opts.categoryId));
  }
  if (opts.type !== undefined) {
    conditions.push(eq(financeTransactions.type, opts.type));
  }
  if (opts.fromDate !== undefined) {
    conditions.push(gte(financeTransactions.date, opts.fromDate));
  }
  if (opts.toDate !== undefined) {
    conditions.push(lte(financeTransactions.date, opts.toDate));
  }
  if (!opts.includeCorrections) {
    conditions.push(eq(financeTransactions.isCorrection, false));
  }

  let query = db
    .select()
    .from(financeTransactions)
    .where(and(...conditions))
    .orderBy(desc(financeTransactions.date), desc(financeTransactions.id));

  if (opts.limit !== undefined) {
    query = query.limit(opts.limit) as typeof query;
  }
  if (opts.offset !== undefined) {
    query = query.offset(opts.offset) as typeof query;
  }

  return query;
}

export async function getTransactionById(
  userId: string,
  budgetId: number,
  transactionId: number,
): Promise<FinanceTransaction | null> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const [row] = await db
    .select()
    .from(financeTransactions)
    .where(and(eq(financeTransactions.id, transactionId), eq(financeTransactions.budgetId, budgetId)));

  return row ?? null;
}

export async function updateTransaction(
  userId: string,
  budgetId: number,
  transactionId: number,
  data: TransactionUpdate,
): Promise<FinanceTransaction> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  return db.transaction(async tx => {
    const [existing] = await tx
      .select()
      .from(financeTransactions)
      .where(and(eq(financeTransactions.id, transactionId), eq(financeTransactions.budgetId, budgetId)));

    if (!existing) throw new Error('Transaction not found');

    const [row] = await tx
      .update(financeTransactions)
      .set({ ...omitNullish(data), updatedAt: new Date() })
      .where(and(eq(financeTransactions.id, transactionId), eq(financeTransactions.budgetId, budgetId)))
      .returning();

    if (!row) throw new Error('Transaction not found');

    const oldPayeeId = existing.payeeId;
    const newPayeeId = data.payeeId !== undefined ? data.payeeId : oldPayeeId;
    const payeeChanged = data.payeeId !== undefined && data.payeeId !== oldPayeeId;

    if (payeeChanged) {
      if (oldPayeeId != null) await decrementPayeeStats(tx, oldPayeeId, userId);
      if (newPayeeId != null) {
        const categoryId = data.categoryId !== undefined ? data.categoryId : existing.categoryId;
        await incrementPayeeStats(tx, newPayeeId, userId, categoryId ?? null);
      }
    } else if (newPayeeId != null && data.categoryId !== undefined && data.categoryId !== existing.categoryId) {
      // Same payee but category changed — update lastUsedCategoryId
      await incrementPayeeStats(tx, newPayeeId, userId, data.categoryId ?? null);
    }

    return row;
  });
}

export async function deleteTransaction(userId: string, budgetId: number, transactionId: number): Promise<void> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  await db.transaction(async tx => {
    const [existing] = await tx
      .select()
      .from(financeTransactions)
      .where(and(eq(financeTransactions.id, transactionId), eq(financeTransactions.budgetId, budgetId)));

    if (!existing) return;

    await tx
      .delete(financeTransactions)
      .where(and(eq(financeTransactions.id, transactionId), eq(financeTransactions.budgetId, budgetId)));

    if (existing.payeeId != null) {
      await decrementPayeeStats(tx, existing.payeeId, userId);
    }
  });
}
