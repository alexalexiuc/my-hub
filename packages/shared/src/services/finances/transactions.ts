/**
 * Finance transaction CRUD
 * - addTransaction(userId, budgetId, data) — inserts a transaction; sets addedByUserId from session
 * - getTransactions(userId, budgetId, opts?) — lists transactions with optional filters (date range, account, category, type)
 * - getTransactionById(userId, budgetId, transactionId) — single transaction with access check
 * - updateTransaction(userId, budgetId, transactionId, data) — partial update
 * - deleteTransaction(userId, budgetId, transactionId) — hard delete
 * Types: TransactionInsert, TransactionUpdate, GetTransactionsOpts
 */
import { and, desc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { db } from '../../db/client';
import { financeTransactions } from '../../db/schema/finances';
import { omitNullish } from '../../utils';
import { verifyBudgetAccess } from './budgets';
import type { FinanceTransaction, NewFinanceTransaction } from '../../types';
import type { TransactionType } from '../../constants/finances';

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
    | 'merchantId'
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

  const [row] = await db
    .insert(financeTransactions)
    .values({ ...data, budgetId, addedByUserId: userId })
    .returning();

  if (!row) throw new Error('Insert did not return a row');
  return row;
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

  const [row] = await db
    .update(financeTransactions)
    .set({ ...omitNullish(data), updatedAt: new Date() })
    .where(and(eq(financeTransactions.id, transactionId), eq(financeTransactions.budgetId, budgetId)))
    .returning();

  if (!row) throw new Error('Transaction not found');
  return row;
}

export async function deleteTransaction(userId: string, budgetId: number, transactionId: number): Promise<void> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  await db
    .delete(financeTransactions)
    .where(and(eq(financeTransactions.id, transactionId), eq(financeTransactions.budgetId, budgetId)));
}
