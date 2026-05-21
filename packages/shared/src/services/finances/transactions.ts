/**
 * Finance transaction CRUD
 * - addTransaction(userId, budgetId, data) — inserts a transaction; updates account balances and payee stats
 * - addCorrectionTransaction(userId, budgetId, data) — balance correction by target value; delta computed atomically from live DB balance; returns CorrectionResult or null if already at target
 * - getTransactions(userId, budgetId, opts?) — lists transactions with optional filters (accountId, categoryId, type, fromDate, toDate, includeCorrections, search, label, amountGte, amountLte, limit, offset)
 * - getTransactionListItems(userId, budgetId, opts?) — same filters as getTransactions; returns pre-resolved display fields (accountName/Currency, toAccountName/Currency, categoryId/Name/Color/Icon, payeeId/Name, addedByUserId/Initials, createdAt, balances) via JOIN
 * - getTransactionListItemById(userId, budgetId, transactionId) — single TransactionListItem with resolved display fields; null if not found
 * - countTransactions(userId, budgetId, opts?) — same filters; returns total count
 * - getTransactionById(userId, budgetId, transactionId) — single transaction with access check
 * - updateTransaction(userId, budgetId, transactionId, data) — partial update; recomputes account balances; adjusts payee stats when payeeId changes
 * - deleteTransaction(userId, budgetId, transactionId) — hard delete; reverses account balance effects; decrements payee stats
 * - checkDuplicateTransaction(userId, budgetId, opts) — checks for existing transaction matching (accountId, date, amount, payeeId)
 * Types: TransactionInsert, TransactionUpdate, GetTransactionsOpts, DuplicateCheckOpts, TransactionListItem, CorrectionInsert, CorrectionResult
 */
import { and, desc, eq, gte, ilike, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../db/client';
import {
  financeAccounts,
  financeBudgets,
  financeCategories,
  financeGroups,
  financePayees,
  financeTransactions,
} from '../../db/schema/finances';
import { users } from '../../db/schema/users';
import { logger, omitUndefined } from '../../utils';
import { hasAccessToBudget } from './budgets';
import { syncTransactionWithPlan } from './monthly-plans';
import { getExchangeRate } from './exchangeRates';
import type { FinanceTransaction, NewFinanceTransaction } from '../../types';
import { CategoryIcon, TransactionTypes, type TransactionType } from '../../constants/finances';

export type TransactionInsert = Omit<
  NewFinanceTransaction,
  'id' | 'budgetId' | 'addedByUserId' | 'createdAt' | 'updatedAt'
> & {
  amountCurrency?: string;
};
export type TransactionUpdate = Partial<
  Pick<
    TransactionInsert,
    | 'type'
    | 'accountId'
    | 'toAccountId'
    | 'amount'
    | 'exchangeRate'
    | 'toExchangeRate'
    | 'date'
    | 'categoryId'
    | 'payeeId'
    | 'notes'
    | 'labels'
    | 'extras'
    | 'isCorrection'
    | 'fromAccountBalanceAfter'
    | 'toAccountBalanceAfter'
  >
>;

export interface GetTransactionsOpts {
  accountId?: number;
  categoryId?: number | null;
  payeeId?: number | null;
  type?: TransactionType;
  fromDate?: string;
  toDate?: string;
  includeCorrections?: boolean;
  search?: string;
  label?: string;
  addedByUserId?: string;
  amountGte?: number;
  amountLte?: number;
  limit?: number;
  offset?: number;
}

export interface DuplicateCheckOpts {
  accountId: number;
  date: string;
  amount: number;
  payeeId: number | null;
}

export interface TransactionListItem {
  id: number;
  date: string;
  amount: number;
  type: TransactionType;
  isCorrection: boolean;
  notes: string | null;
  labels: string[];
  accountId: number;
  accountName: string;
  accountCurrency: string;
  toAccountId: number | null;
  toAccountName: string | null;
  toAccountCurrency: string | null;
  categoryId: number | null;
  groupName: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: CategoryIcon | null;
  payeeId: number | null;
  payeeName: string | null;
  addedByUserId: string;
  addedByInitials: string | null;
  createdAt: Date;
  fromAccountBalanceAfter: number | null;
  toAccountBalanceAfter: number | null;
}

function computeInitials(name: string | null, email: string): string {
  const raw = name?.trim() || email;
  const parts = raw.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length >= 2 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return parts.length >= 2 ? (first + last).toUpperCase() : raw.slice(0, 2).toUpperCase();
}

function buildListConditions(budgetId: number, opts: GetTransactionsOpts) {
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
  if (opts.payeeId === null) {
    conditions.push(isNull(financeTransactions.payeeId));
  } else if (opts.payeeId !== undefined) {
    conditions.push(eq(financeTransactions.payeeId, opts.payeeId));
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
  if (opts.search !== undefined && opts.search.trim() !== '') {
    conditions.push(ilike(financeTransactions.notes, `%${opts.search}%`));
  }
  if (opts.label !== undefined) {
    conditions.push(sql`${financeTransactions.labels} @> ${JSON.stringify([opts.label])}::jsonb`);
  }
  if (opts.addedByUserId !== undefined) {
    conditions.push(eq(financeTransactions.addedByUserId, opts.addedByUserId));
  }
  if (opts.amountGte !== undefined) {
    conditions.push(gte(financeTransactions.amount, opts.amountGte));
  }
  if (opts.amountLte !== undefined) {
    conditions.push(lte(financeTransactions.amount, opts.amountLte));
  }
  return conditions;
}

function buildListQuery(budgetId: number, opts: GetTransactionsOpts, extraConditions: SQL[] = []) {
  const fromAcct = alias(financeAccounts, 'from_acct');
  const toAcct = alias(financeAccounts, 'to_acct');
  const conditions = [...buildListConditions(budgetId, opts), ...extraConditions];

  let q = db
    .select({
      id: financeTransactions.id,
      date: financeTransactions.date,
      amount: financeTransactions.amount,
      type: financeTransactions.type,
      isCorrection: financeTransactions.isCorrection,
      notes: financeTransactions.notes,
      labels: financeTransactions.labels,
      accountId: financeTransactions.accountId,
      accountName: fromAcct.name,
      accountCurrency: fromAcct.currency,
      toAccountId: financeTransactions.toAccountId,
      toAccountName: toAcct.name,
      toAccountCurrency: toAcct.currency,
      categoryId: financeTransactions.categoryId,
      categoryName: financeCategories.name,
      categoryColor: financeCategories.color,
      categoryIcon: financeCategories.icon,
      groupName: financeGroups.name,
      payeeId: financeTransactions.payeeId,
      payeeName: financePayees.name,
      addedByUserId: financeTransactions.addedByUserId,
      addedByUserName: users.name,
      addedByUserEmail: users.email,
      createdAt: financeTransactions.createdAt,
      fromAccountBalanceAfter: financeTransactions.fromAccountBalanceAfter,
      toAccountBalanceAfter: financeTransactions.toAccountBalanceAfter,
    })
    .from(financeTransactions)
    .innerJoin(fromAcct, eq(financeTransactions.accountId, fromAcct.id))
    .leftJoin(toAcct, eq(financeTransactions.toAccountId, toAcct.id))
    .leftJoin(financeCategories, eq(financeTransactions.categoryId, financeCategories.id))
    .leftJoin(financePayees, eq(financeTransactions.payeeId, financePayees.id))
    .leftJoin(financeGroups, eq(financeCategories.groupId, financeGroups.id))
    .innerJoin(users, eq(financeTransactions.addedByUserId, users.id))
    .where(and(...conditions))
    .orderBy(desc(financeTransactions.date), desc(financeTransactions.id));

  if (opts.limit !== undefined) {
    q = q.limit(opts.limit) as typeof q;
  }
  if (opts.offset !== undefined) {
    q = q.offset(opts.offset) as typeof q;
  }
  return q;
}

function rowToListItem(row: Awaited<ReturnType<typeof buildListQuery>>[number]): TransactionListItem {
  return {
    id: row.id,
    date: row.date,
    amount: row.amount,
    type: row.type,
    isCorrection: row.isCorrection,
    notes: row.notes ?? null,
    labels: (row.labels as string[]) ?? [],
    accountId: row.accountId,
    accountName: row.accountName,
    accountCurrency: row.accountCurrency,
    toAccountId: row.toAccountId ?? null,
    toAccountName: row.toAccountName ?? null,
    toAccountCurrency: row.toAccountCurrency ?? null,
    categoryId: row.categoryId ?? null,
    categoryName: row.categoryName ?? null,
    categoryColor: row.categoryColor ?? null,
    categoryIcon: row.categoryIcon ?? null,
    groupName: row.groupName ?? null,
    payeeId: row.payeeId ?? null,
    payeeName: row.payeeName ?? null,
    addedByUserId: row.addedByUserId,
    addedByInitials: computeInitials(row.addedByUserName, row.addedByUserEmail),
    createdAt: row.createdAt,
    fromAccountBalanceAfter: row.fromAccountBalanceAfter ?? null,
    toAccountBalanceAfter: row.toAccountBalanceAfter ?? null,
  };
}

export async function getTransactionListItems(
  userId: string,
  budgetId: number,
  opts: GetTransactionsOpts = {},
): Promise<TransactionListItem[]> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }
  const rows = await buildListQuery(budgetId, opts);
  return rows.map(rowToListItem);
}

export async function getTransactionListItemById(
  userId: string,
  budgetId: number,
  transactionId: number,
): Promise<TransactionListItem | null> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }
  const rows = await buildListQuery(budgetId, { includeCorrections: true }, [
    eq(financeTransactions.id, transactionId),
  ]);
  return rows[0] ? rowToListItem(rows[0]) : null;
}

function normalizeCurrency(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return normalized.length === 3 ? normalized : null;
}

function getOriginalCurrencyFromExtras(extras: TransactionInsert['extras']): string | null {
  return normalizeCurrency(extras?.conversion?.originalCurrency);
}

export async function addTransaction(
  userId: string,
  budgetId: number,
  data: TransactionInsert,
): Promise<FinanceTransaction> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  if (data.type === TransactionTypes.Transfer && data.toAccountId == null) {
    throw new Error('Transfer transactions require a destination account (toAccountId)');
  }

  const amt = Math.round(data.amount * 10000) / 10000;
  const { amountCurrency, ...dbData } = data;

  const result = await db.transaction(async tx => {
    const [budget] = await tx
      .select({ defaultCurrency: financeBudgets.defaultCurrency })
      .from(financeBudgets)
      .where(eq(financeBudgets.id, budgetId));
    if (!budget) throw new Error('Budget not found');

    const [fromAccount] = await tx
      .select({ balance: financeAccounts.balance, currency: financeAccounts.currency })
      .from(financeAccounts)
      .where(and(eq(financeAccounts.id, data.accountId), eq(financeAccounts.budgetId, budgetId)));

    if (!fromAccount) throw new Error('Account not found');

    const originalCurrency = normalizeCurrency(amountCurrency) ?? getOriginalCurrencyFromExtras(data.extras);
    let effectiveAmount = amt;
    let resolvedExtras = data.extras;

    if (originalCurrency != null) {
      const originalToAccountRate =
        originalCurrency !== fromAccount.currency
          ? await getExchangeRate(originalCurrency, fromAccount.currency, data.date)
          : 1;
      effectiveAmount = Math.round(amt * originalToAccountRate * 10000) / 10000;
      resolvedExtras = {
        ...(data.extras ?? { kind: 'base' }),
        conversion: {
          ...(data.extras?.conversion ?? {}),
          originalAmount: amt,
          originalCurrency,
          accountCurrency: fromAccount.currency,
          originalToAccountRate,
          convertedAmount: effectiveAmount,
        },
      } as TransactionInsert['extras'];
    }

    const resolvedExchangeRate =
      data.exchangeRate ??
      (fromAccount.currency !== budget.defaultCurrency
        ? await getExchangeRate(fromAccount.currency, budget.defaultCurrency, data.date)
        : 1);

    const fromBalanceAfter =
      data.type === TransactionTypes.Income
        ? fromAccount.balance + effectiveAmount
        : fromAccount.balance - effectiveAmount;

    await tx
      .update(financeAccounts)
      .set({ balance: fromBalanceAfter, updatedAt: new Date() })
      .where(and(eq(financeAccounts.id, data.accountId), eq(financeAccounts.budgetId, budgetId)));

    let toBalanceAfter: number | null = null;
    let resolvedToExchangeRate = data.toExchangeRate ?? null;

    if (data.type === TransactionTypes.Transfer && data.toAccountId != null) {
      const [toAccount] = await tx
        .select({ balance: financeAccounts.balance, currency: financeAccounts.currency })
        .from(financeAccounts)
        .where(and(eq(financeAccounts.id, data.toAccountId), eq(financeAccounts.budgetId, budgetId)));

      if (!toAccount) throw new Error('Destination account not found');

      if (resolvedToExchangeRate == null) {
        resolvedToExchangeRate =
          fromAccount.currency !== toAccount.currency
            ? await getExchangeRate(fromAccount.currency, toAccount.currency, data.date)
            : 1;
      }

      toBalanceAfter = toAccount.balance + effectiveAmount * resolvedToExchangeRate;

      await tx
        .update(financeAccounts)
        .set({ balance: toBalanceAfter, updatedAt: new Date() })
        .where(and(eq(financeAccounts.id, data.toAccountId), eq(financeAccounts.budgetId, budgetId)));
    }

    const [row] = await tx
      .insert(financeTransactions)
      .values({
        ...dbData,
        amount: effectiveAmount,
        exchangeRate: resolvedExchangeRate,
        toExchangeRate: resolvedToExchangeRate,
        extras: resolvedExtras,
        budgetId,
        addedByUserId: userId,
        fromAccountBalanceAfter: fromBalanceAfter,
        toAccountBalanceAfter: toBalanceAfter,
      })
      .returning();

    if (!row) throw new Error('Insert did not return a row');

    return row;
  });

  // Sync with monthly plan is nice to have, but we don't want to fail the whole transaction if it errors out.
  syncTransactionWithPlan(userId, budgetId, null, result).catch(err => {
    logger.error('Error syncing plan items after transaction insert:', err);
  });
  return result;
}

export interface CorrectionInsert {
  accountId: number;
  targetBalance: number;
  date: string;
  notes?: string | null;
  source: 'hub' | 'mcp';
}

export interface CorrectionResult {
  transaction: FinanceTransaction;
  /** Signed delta applied: positive = credit, negative = debit. */
  correctionAmount: number;
  type: string;
}

/**
 * Create a balance-correction transaction by specifying the desired final balance.
 * The delta is computed atomically inside a DB transaction against the live balance,
 * preventing race conditions from stale UI or MCP data.
 * Returns null if the account balance already equals targetBalance.
 */
export async function addCorrectionTransaction(
  userId: string,
  budgetId: number,
  data: CorrectionInsert,
): Promise<CorrectionResult | null> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const result = await db.transaction(async tx => {
    const [account] = await tx
      .select({ balance: financeAccounts.balance, currency: financeAccounts.currency })
      .from(financeAccounts)
      .where(and(eq(financeAccounts.id, data.accountId), eq(financeAccounts.budgetId, budgetId)));

    if (!account) throw new Error('Account not found');

    const delta = data.targetBalance - account.balance;

    // Treat sub-0.0001 deltas as zero (matches 4-decimal DB precision)
    if (Math.abs(delta) < 0.00005) return null;

    const type = delta > 0 ? TransactionTypes.Income : TransactionTypes.Expense;
    const amount = Math.round(Math.abs(delta) * 10000) / 10000;
    const balanceAfter = Math.round(data.targetBalance * 10000) / 10000;

    const [budget] = await tx
      .select({ defaultCurrency: financeBudgets.defaultCurrency })
      .from(financeBudgets)
      .where(eq(financeBudgets.id, budgetId));
    if (!budget) throw new Error('Budget not found');

    const exchangeRate =
      account.currency !== budget.defaultCurrency
        ? await getExchangeRate(account.currency, budget.defaultCurrency, data.date)
        : 1;

    await tx
      .update(financeAccounts)
      .set({ balance: balanceAfter, updatedAt: new Date() })
      .where(and(eq(financeAccounts.id, data.accountId), eq(financeAccounts.budgetId, budgetId)));

    const [row] = await tx
      .insert(financeTransactions)
      .values({
        type,
        amount,
        date: data.date,
        accountId: data.accountId,
        budgetId,
        addedByUserId: userId,
        categoryId: null,
        payeeId: null,
        toAccountId: null,
        notes: data.notes ?? null,
        isCorrection: true,
        source: data.source,
        exchangeRate,
        toExchangeRate: null,
        fromAccountBalanceAfter: balanceAfter,
        toAccountBalanceAfter: null,
        extras: null,
        labels: [],
      })
      .returning();

    if (!row) throw new Error('Insert did not return a row');

    return { transaction: row, correctionAmount: delta, type };
  });

  if (result == null) return null;

  syncTransactionWithPlan(userId, budgetId, null, result.transaction).catch(err => {
    logger.error('Error syncing plan items after correction:', err);
  });

  return result;
}

export async function getTransactions(
  userId: string,
  budgetId: number,
  opts: GetTransactionsOpts = {},
): Promise<FinanceTransaction[]> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const conditions = buildListConditions(budgetId, opts);

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
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const conditions = buildListConditions(budgetId, opts);

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
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const normalizedAmount = Math.round(opts.amount * 10000) / 10000;
  const conditions = [
    eq(financeTransactions.budgetId, budgetId),
    eq(financeTransactions.accountId, opts.accountId),
    eq(financeTransactions.date, opts.date),
    eq(financeTransactions.amount, normalizedAmount),
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
  if (!(await hasAccessToBudget(userId, budgetId))) {
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
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const result = await db.transaction(async tx => {
    const [existing] = await tx
      .select()
      .from(financeTransactions)
      .where(and(eq(financeTransactions.id, transactionId), eq(financeTransactions.budgetId, budgetId)));

    if (!existing) throw new Error('Transaction not found');

    // ── Reverse old balance effect ─────────────────────────────────────────
    const oldAmt = existing.amount;
    const oldToExRate = existing.toExchangeRate ?? 1;

    const [oldFromAcct] = await tx
      .select({ balance: financeAccounts.balance })
      .from(financeAccounts)
      .where(and(eq(financeAccounts.id, existing.accountId), eq(financeAccounts.budgetId, budgetId)));
    if (!oldFromAcct) throw new Error('Source account not found');

    const oldFromBalanceRestored =
      existing.type === TransactionTypes.Income ? oldFromAcct.balance - oldAmt : oldFromAcct.balance + oldAmt;

    await tx
      .update(financeAccounts)
      .set({ balance: oldFromBalanceRestored, updatedAt: new Date() })
      .where(and(eq(financeAccounts.id, existing.accountId), eq(financeAccounts.budgetId, budgetId)));

    if (existing.type === TransactionTypes.Transfer && existing.toAccountId != null) {
      const [oldToAcct] = await tx
        .select({ balance: financeAccounts.balance })
        .from(financeAccounts)
        .where(and(eq(financeAccounts.id, existing.toAccountId), eq(financeAccounts.budgetId, budgetId)));
      if (oldToAcct) {
        const oldToBalanceRestored = oldToAcct.balance - oldAmt * oldToExRate;
        await tx
          .update(financeAccounts)
          .set({ balance: oldToBalanceRestored, updatedAt: new Date() })
          .where(and(eq(financeAccounts.id, existing.toAccountId), eq(financeAccounts.budgetId, budgetId)));
      }
    }

    // ── Apply new balance effect ───────────────────────────────────────────
    const newType = data.type ?? existing.type;
    const newAccountId = data.accountId ?? existing.accountId;
    const newToAccountId = data.toAccountId ?? existing.toAccountId;
    const newDate = data.date ?? existing.date;

    if (newType === TransactionTypes.Transfer && newToAccountId == null) {
      throw new Error('Transfer transactions require a destination account (toAccountId)');
    }

    const newAmt = data.amount != null ? Math.round(data.amount * 10000) / 10000 : oldAmt;

    const [newFromAcct] = await tx
      .select({ balance: financeAccounts.balance, currency: financeAccounts.currency })
      .from(financeAccounts)
      .where(and(eq(financeAccounts.id, newAccountId), eq(financeAccounts.budgetId, budgetId)));
    if (!newFromAcct) throw new Error('New source account not found');

    // Re-resolve exchangeRate only when account/date changed and caller did not provide an explicit rate.
    const fromFxChanged = data.exchangeRate === undefined && (data.accountId !== undefined || data.date !== undefined);

    let budgetDefaultCurrency: string | null = null;
    if (fromFxChanged) {
      const [budget] = await tx
        .select({ defaultCurrency: financeBudgets.defaultCurrency })
        .from(financeBudgets)
        .where(eq(financeBudgets.id, budgetId));
      if (!budget) throw new Error('Budget not found');
      budgetDefaultCurrency = budget.defaultCurrency;
    }

    const resolvedExchangeRate =
      data.exchangeRate ??
      (fromFxChanged
        ? newFromAcct.currency !== budgetDefaultCurrency
          ? await getExchangeRate(newFromAcct.currency, budgetDefaultCurrency!, newDate)
          : 1
        : existing.exchangeRate);

    const newFromBalanceAfter =
      newType === TransactionTypes.Income ? newFromAcct.balance + newAmt : newFromAcct.balance - newAmt;

    await tx
      .update(financeAccounts)
      .set({ balance: newFromBalanceAfter, updatedAt: new Date() })
      .where(and(eq(financeAccounts.id, newAccountId), eq(financeAccounts.budgetId, budgetId)));

    let newToBalanceAfter: number | null = null;
    let resolvedToExchangeRate: number | null = null;

    if (newType === TransactionTypes.Transfer && newToAccountId != null) {
      const [newToAcct] = await tx
        .select({ balance: financeAccounts.balance, currency: financeAccounts.currency })
        .from(financeAccounts)
        .where(and(eq(financeAccounts.id, newToAccountId), eq(financeAccounts.budgetId, budgetId)));
      if (!newToAcct) throw new Error('New destination account not found');

      // Re-resolve toExchangeRate only when account/date changed and caller did not provide an explicit rate.
      const toFxChanged =
        data.toExchangeRate === undefined &&
        (data.accountId !== undefined || data.toAccountId !== undefined || data.date !== undefined);
      resolvedToExchangeRate =
        data.toExchangeRate ??
        (toFxChanged
          ? newFromAcct.currency !== newToAcct.currency
            ? await getExchangeRate(newFromAcct.currency, newToAcct.currency, newDate)
            : 1
          : (existing.toExchangeRate ?? 1));

      newToBalanceAfter = newToAcct.balance + newAmt * resolvedToExchangeRate;
      await tx
        .update(financeAccounts)
        .set({ balance: newToBalanceAfter, updatedAt: new Date() })
        .where(and(eq(financeAccounts.id, newToAccountId), eq(financeAccounts.budgetId, budgetId)));
    }

    // ── Persist updated transaction row ───────────────────────────────────
    const [row] = await tx
      .update(financeTransactions)
      .set({
        ...omitUndefined(data),
        amount: newAmt,
        exchangeRate: resolvedExchangeRate,
        toExchangeRate: resolvedToExchangeRate,
        fromAccountBalanceAfter: newFromBalanceAfter,
        toAccountBalanceAfter: newToBalanceAfter,
        updatedAt: new Date(),
      })
      .where(and(eq(financeTransactions.id, transactionId), eq(financeTransactions.budgetId, budgetId)))
      .returning();

    if (!row) throw new Error('Transaction not found');

    return { row, previous: existing };
  });

  // Sync with monthly plan is nice to have, but we don't want to fail the whole transaction if it errors out.
  syncTransactionWithPlan(userId, budgetId, result.previous, result.row).catch(err => {
    logger.error('Error syncing plan items after transaction update:', err);
  });
  return result.row;
}

export async function deleteTransaction(
  userId: string,
  budgetId: number,
  transactionId: number,
): Promise<{ accountBalanceAfter: number }> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const result = await db.transaction(async tx => {
    const [existing] = await tx
      .select()
      .from(financeTransactions)
      .where(and(eq(financeTransactions.id, transactionId), eq(financeTransactions.budgetId, budgetId)));

    if (!existing) throw new Error('Transaction not found');

    // Reverse balance effect on source/from account
    const amt = existing.amount;
    const toExRate = existing.toExchangeRate ?? 1;

    const [fromAcct] = await tx
      .select({ balance: financeAccounts.balance })
      .from(financeAccounts)
      .where(and(eq(financeAccounts.id, existing.accountId), eq(financeAccounts.budgetId, budgetId)));

    if (!fromAcct) throw new Error('Account not found');

    const fromBalanceAfter =
      existing.type === TransactionTypes.Income ? fromAcct.balance - amt : fromAcct.balance + amt;

    await tx
      .update(financeAccounts)
      .set({ balance: fromBalanceAfter, updatedAt: new Date() })
      .where(and(eq(financeAccounts.id, existing.accountId), eq(financeAccounts.budgetId, budgetId)));

    if (existing.type === TransactionTypes.Transfer && existing.toAccountId != null) {
      const [toAcct] = await tx
        .select({ balance: financeAccounts.balance })
        .from(financeAccounts)
        .where(and(eq(financeAccounts.id, existing.toAccountId), eq(financeAccounts.budgetId, budgetId)));
      if (toAcct) {
        const toBalanceAfter = toAcct.balance - amt * toExRate;
        await tx
          .update(financeAccounts)
          .set({ balance: toBalanceAfter, updatedAt: new Date() })
          .where(and(eq(financeAccounts.id, existing.toAccountId), eq(financeAccounts.budgetId, budgetId)));
      }
    }

    await tx
      .delete(financeTransactions)
      .where(and(eq(financeTransactions.id, transactionId), eq(financeTransactions.budgetId, budgetId)));

    return { accountBalanceAfter: fromBalanceAfter, deleted: existing };
  });

  // Sync with monthly plan is nice to have, but we don't want to fail the whole transaction if it errors out.
  syncTransactionWithPlan(userId, budgetId, result.deleted, null).catch(err => {
    logger.error('Error syncing plan items after transaction delete:', err);
  });

  return { accountBalanceAfter: result.accountBalanceAfter };
}
