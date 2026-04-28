/**
 * Finance transaction CRUD
 * - addTransaction(userId, budgetId, data) — inserts a transaction; updates account balances and payee stats
 * - getTransactions(userId, budgetId, opts?) — lists transactions with optional filters (date range, account, category, type, search, isCorrection)
 * - getTransactionById(userId, budgetId, transactionId) — single transaction with access check
 * - updateTransaction(userId, budgetId, transactionId, data) — partial update; recomputes account balances; adjusts payee stats when payeeId changes
 * - deleteTransaction(userId, budgetId, transactionId) — hard delete; reverses account balance effects; decrements payee stats
 * - checkDuplicateTransaction(userId, budgetId, opts) — checks for existing transaction matching (accountId, date, amount, payeeId)
 * Types: TransactionInsert, TransactionUpdate, GetTransactionsOpts, DuplicateCheckOpts
 */
import { and, desc, eq, gte, ilike, isNull, lte, or, sql } from 'drizzle-orm';
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
  search?: string;
  limit?: number;
  offset?: number;
}

export interface DuplicateCheckOpts {
  accountId: number;
  date: string;
  amount: string;
  payeeId: number | null;
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
  if (opts.search !== undefined) {
    conditions.push(ilike(financeTransactions.notes, `%${opts.search}%`));
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

export async function countTransactions(
  userId: string,
  budgetId: number,
  opts: GetTransactionsOpts = {},
): Promise<number> {
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
  if (opts.search !== undefined) {
    conditions.push(ilike(financeTransactions.notes, `%${opts.search}%`));
  }

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(financeTransactions)
    .where(and(...conditions));

  return row?.count ?? 0;
}

export async function checkDuplicateTransaction(
  userId: string,
  budgetId: number,
  opts: DuplicateCheckOpts,
): Promise<FinanceTransaction | null> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const conditions = [
    eq(financeTransactions.budgetId, budgetId),
    eq(financeTransactions.accountId, opts.accountId),
    eq(financeTransactions.date, opts.date),
    eq(financeTransactions.amount, opts.amount),
  ];

  if (opts.payeeId === null) {
    conditions.push(isNull(financeTransactions.payeeId));
  } else {
    conditions.push(eq(financeTransactions.payeeId, opts.payeeId));
  }

  const [row] = await db
    .select()
    .from(financeTransactions)
    .where(and(...conditions))
    .limit(1);

  return row ?? null;
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

    // ── Reverse old balance effect ─────────────────────────────────────────
    const oldAmt = parseFloat(existing.amount);
    const oldExRate = parseFloat(existing.exchangeRate ?? '1');

    const [oldFromAcct] = await tx
      .select({ balance: financeAccounts.balance })
      .from(financeAccounts)
      .where(and(eq(financeAccounts.id, existing.accountId), eq(financeAccounts.budgetId, budgetId)));
    if (!oldFromAcct) throw new Error('Source account not found');

    const oldFromBalanceRestored =
      existing.type === TransactionTypes.Income
        ? parseFloat(oldFromAcct.balance) - oldAmt
        : parseFloat(oldFromAcct.balance) + oldAmt;

    await tx
      .update(financeAccounts)
      .set({ balance: String(oldFromBalanceRestored), updatedAt: new Date() })
      .where(and(eq(financeAccounts.id, existing.accountId), eq(financeAccounts.budgetId, budgetId)));

    if (existing.type === TransactionTypes.Transfer && existing.toAccountId != null) {
      const [oldToAcct] = await tx
        .select({ balance: financeAccounts.balance })
        .from(financeAccounts)
        .where(and(eq(financeAccounts.id, existing.toAccountId), eq(financeAccounts.budgetId, budgetId)));
      if (oldToAcct) {
        const oldToBalanceRestored = parseFloat(oldToAcct.balance) - oldAmt * oldExRate;
        await tx
          .update(financeAccounts)
          .set({ balance: String(oldToBalanceRestored), updatedAt: new Date() })
          .where(and(eq(financeAccounts.id, existing.toAccountId), eq(financeAccounts.budgetId, budgetId)));
      }
    }

    // ── Apply new balance effect ───────────────────────────────────────────
    const newType = data.type ?? existing.type;
    const newAccountId = data.accountId ?? existing.accountId;
    const newToAccountId = data.toAccountId !== undefined ? data.toAccountId : existing.toAccountId;
    const newAmt = data.amount !== undefined ? parseFloat(data.amount) : oldAmt;
    const newExRate = data.exchangeRate !== undefined ? parseFloat(data.exchangeRate) : oldExRate;

    const [newFromAcct] = await tx
      .select({ balance: financeAccounts.balance })
      .from(financeAccounts)
      .where(and(eq(financeAccounts.id, newAccountId), eq(financeAccounts.budgetId, budgetId)));
    if (!newFromAcct) throw new Error('New source account not found');

    const newFromBalanceAfter =
      newType === TransactionTypes.Income
        ? parseFloat(newFromAcct.balance) + newAmt
        : parseFloat(newFromAcct.balance) - newAmt;

    await tx
      .update(financeAccounts)
      .set({ balance: String(newFromBalanceAfter), updatedAt: new Date() })
      .where(and(eq(financeAccounts.id, newAccountId), eq(financeAccounts.budgetId, budgetId)));

    let newToBalanceAfter: number | null = null;

    if (newType === TransactionTypes.Transfer && newToAccountId != null) {
      const [newToAcct] = await tx
        .select({ balance: financeAccounts.balance })
        .from(financeAccounts)
        .where(and(eq(financeAccounts.id, newToAccountId), eq(financeAccounts.budgetId, budgetId)));
      if (!newToAcct) throw new Error('New destination account not found');
      newToBalanceAfter = parseFloat(newToAcct.balance) + newAmt * newExRate;
      await tx
        .update(financeAccounts)
        .set({ balance: String(newToBalanceAfter), updatedAt: new Date() })
        .where(and(eq(financeAccounts.id, newToAccountId), eq(financeAccounts.budgetId, budgetId)));
    }

    // ── Persist updated transaction row ───────────────────────────────────
    const [row] = await tx
      .update(financeTransactions)
      .set({
        ...omitNullish(data),
        fromAccountBalanceAfter: String(newFromBalanceAfter),
        toAccountBalanceAfter: newToBalanceAfter != null ? String(newToBalanceAfter) : null,
        updatedAt: new Date(),
      })
      .where(and(eq(financeTransactions.id, transactionId), eq(financeTransactions.budgetId, budgetId)))
      .returning();

    if (!row) throw new Error('Transaction not found');

    // ── Payee stats ────────────────────────────────────────────────────────
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
      await incrementPayeeStats(tx, newPayeeId, userId, data.categoryId ?? null);
    }

    return row;
  });
}

export async function deleteTransaction(
  userId: string,
  budgetId: number,
  transactionId: number,
): Promise<{ accountBalanceAfter: string }> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  return db.transaction(async tx => {
    const [existing] = await tx
      .select()
      .from(financeTransactions)
      .where(and(eq(financeTransactions.id, transactionId), eq(financeTransactions.budgetId, budgetId)));

    if (!existing) throw new Error('Transaction not found');

    // Reverse balance effect on source/from account
    const amt = parseFloat(existing.amount);
    const exRate = parseFloat(existing.exchangeRate ?? '1');

    const [fromAcct] = await tx
      .select({ balance: financeAccounts.balance })
      .from(financeAccounts)
      .where(and(eq(financeAccounts.id, existing.accountId), eq(financeAccounts.budgetId, budgetId)));

    if (!fromAcct) throw new Error('Account not found');

    const fromBalanceAfter =
      existing.type === TransactionTypes.Income
        ? parseFloat(fromAcct.balance) - amt
        : parseFloat(fromAcct.balance) + amt;

    await tx
      .update(financeAccounts)
      .set({ balance: String(fromBalanceAfter), updatedAt: new Date() })
      .where(and(eq(financeAccounts.id, existing.accountId), eq(financeAccounts.budgetId, budgetId)));

    if (existing.type === TransactionTypes.Transfer && existing.toAccountId != null) {
      const [toAcct] = await tx
        .select({ balance: financeAccounts.balance })
        .from(financeAccounts)
        .where(and(eq(financeAccounts.id, existing.toAccountId), eq(financeAccounts.budgetId, budgetId)));
      if (toAcct) {
        const toBalanceAfter = parseFloat(toAcct.balance) - amt * exRate;
        await tx
          .update(financeAccounts)
          .set({ balance: String(toBalanceAfter), updatedAt: new Date() })
          .where(and(eq(financeAccounts.id, existing.toAccountId), eq(financeAccounts.budgetId, budgetId)));
      }
    }

    await tx
      .delete(financeTransactions)
      .where(and(eq(financeTransactions.id, transactionId), eq(financeTransactions.budgetId, budgetId)));

    if (existing.payeeId != null) {
      await decrementPayeeStats(tx, existing.payeeId, userId);
    }

    return { accountBalanceAfter: String(fromBalanceAfter) };
  });
}
