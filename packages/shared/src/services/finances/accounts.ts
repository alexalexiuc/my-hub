/**
 * Finance account CRUD
 * - createAccount(userId, budgetId, data) — creates an account inside a budget the user can access
 * - getAccounts(userId, budgetId, opts?) — lists accounts; optionally include archived
 * - getAccountById(userId, budgetId, accountId) — single account with access check
 * - updateAccount(userId, budgetId, accountId, data) — partial update
 * - deleteAccount(userId, budgetId, accountId) — hard delete
 * - getNetWorthHistory(userId, budgetId, limit?) — last N monthly net-worth snapshots, oldest-first
 * - getAllAccountIds() — system maintenance: returns all account IDs across all budgets (worker use only)
 * - recalculateAccountBalance(accountId) — system maintenance: recomputes a single account's balance from openingBalance + transaction history; returns the new balance
 * Types: AccountInsert, AccountUpdate, GetAccountsOpts, NetWorthSnapshot
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { financeAccounts, financeNetWorthSnapshots, financeTransactions } from '../../db/schema/finances';
import { omitUndefined } from '../../utils';
import { hasAccessToBudget } from './budgets';
import type { FinanceAccount, NewFinanceAccount } from '../../types';
import { TransactionTypes } from '../../constants';

export interface NetWorthSnapshot {
  month: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
}

export type AccountInsert = Omit<NewFinanceAccount, 'id' | 'budgetId' | 'createdAt' | 'updatedAt'>;
export type AccountUpdate = Partial<
  Pick<
    AccountInsert,
    'name' | 'description' | 'type' | 'currency' | 'openingBalance' | 'balance' | 'archived' | 'details'
  >
>;

export interface GetAccountsOpts {
  includeArchived?: boolean;
}

export async function createAccount(userId: string, budgetId: number, data: AccountInsert): Promise<FinanceAccount> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const [row] = await db
    .insert(financeAccounts)
    .values({ ...data, budgetId })
    .returning();

  if (!row) throw new Error('Insert did not return a row');
  return row;
}

export async function getAccounts(
  userId: string,
  budgetId: number,
  opts: GetAccountsOpts = {},
): Promise<FinanceAccount[]> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const conditions = [eq(financeAccounts.budgetId, budgetId)];
  if (!opts.includeArchived) {
    conditions.push(eq(financeAccounts.archived, false));
  }

  return db
    .select()
    .from(financeAccounts)
    .where(and(...conditions));
}

export async function getAccountById(
  userId: string,
  budgetId: number,
  accountId: number,
): Promise<FinanceAccount | null> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const [row] = await db
    .select()
    .from(financeAccounts)
    .where(and(eq(financeAccounts.id, accountId), eq(financeAccounts.budgetId, budgetId)));

  return row ?? null;
}

export async function updateAccount(
  userId: string,
  budgetId: number,
  accountId: number,
  data: AccountUpdate,
): Promise<FinanceAccount> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const [row] = await db
    .update(financeAccounts)
    .set({ ...omitUndefined(data), updatedAt: new Date() })
    .where(and(eq(financeAccounts.id, accountId), eq(financeAccounts.budgetId, budgetId)))
    .returning();

  if (!row) throw new Error('Account not found');
  return row;
}

export async function deleteAccount(userId: string, budgetId: number, accountId: number): Promise<void> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  await db
    .delete(financeAccounts)
    .where(and(eq(financeAccounts.id, accountId), eq(financeAccounts.budgetId, budgetId)));
}

export async function getNetWorthHistory(userId: string, budgetId: number, limit = 6): Promise<NetWorthSnapshot[]> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const rows = await db
    .select({
      month: financeNetWorthSnapshots.month,
      netWorth: financeNetWorthSnapshots.netWorth,
      totalAssets: financeNetWorthSnapshots.totalAssets,
      totalLiabilities: financeNetWorthSnapshots.totalLiabilities,
    })
    .from(financeNetWorthSnapshots)
    .where(eq(financeNetWorthSnapshots.budgetId, budgetId))
    .orderBy(desc(financeNetWorthSnapshots.month))
    .limit(limit);

  return rows.reverse().map(r => ({
    month: r.month,
    netWorth: r.netWorth,
    totalAssets: r.totalAssets,
    totalLiabilities: r.totalLiabilities,
  }));
}

/** System maintenance: returns all account IDs across all budgets. No auth required — worker use only. */
export async function getAllAccountIds(): Promise<number[]> {
  const rows = await db.select({ id: financeAccounts.id }).from(financeAccounts);
  return rows.map(r => r.id);
}

/**
 * System maintenance: recomputes a single account's balance from scratch using
 * openingBalance + net transaction history. No user auth required — intended
 * for use by the worker only.
 *
 * Balance formula:
 *   openingBalance
 *   + SUM(income transactions where accountId = account.id: amount)
 *   - SUM(expense/transfer transactions where accountId = account.id: amount)
 *   + SUM(transfer transactions where toAccountId = account.id: amount * toExchangeRate)
 *
 * Returns the new balance, or null if the account does not exist.
 */
export async function recalculateAccountBalance(accountId: number): Promise<number | null> {
  const [account] = await db
    .select({ openingBalance: financeAccounts.openingBalance })
    .from(financeAccounts)
    .where(eq(financeAccounts.id, accountId));

  if (!account) return null;

  const [fromEffect] = await db
    .select({
      net: sql<number>`COALESCE(SUM(CASE WHEN ${financeTransactions.type} = ${TransactionTypes.Income} THEN ${financeTransactions.amount} ELSE -${financeTransactions.amount} END), 0)::float8`,
    })
    .from(financeTransactions)
    .where(eq(financeTransactions.accountId, accountId));

  const [toEffect] = await db
    .select({
      net: sql<number>`COALESCE(SUM(${financeTransactions.amount} * COALESCE(${financeTransactions.toExchangeRate}, 1)), 0)::float8`,
    })
    .from(financeTransactions)
    .where(
      and(eq(financeTransactions.toAccountId, accountId), eq(financeTransactions.type, TransactionTypes.Transfer)),
    );

  const newBalance = account.openingBalance + (fromEffect?.net ?? 0) + (toEffect?.net ?? 0);

  await db
    .update(financeAccounts)
    .set({ balance: newBalance, updatedAt: new Date() })
    .where(eq(financeAccounts.id, accountId));

  return newBalance;
}
