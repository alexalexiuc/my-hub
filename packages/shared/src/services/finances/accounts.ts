/**
 * Finance account CRUD
 * - createAccount(userId, budgetId, data) — creates an account inside a budget the user can access
 * - getAccounts(userId, budgetId, opts?) — lists accounts; optionally include archived
 * - getAccountById(userId, budgetId, accountId) — single account with access check
 * - updateAccount(userId, budgetId, accountId, data) — partial update
 * - deleteAccount(userId, budgetId, accountId) — hard delete
 * - getNetWorthHistory(userId, budgetId, limit?) — last N monthly net-worth snapshots, oldest-first
 * - getAvailableBalance(userId, budgetId) — sum of included non-archived account balances (liabilities subtracted). Default: bank+cash included, all others excluded. Per-user rows in financeAccountAvailability override the default.
 * - getAvailabilityPreferences(userId, budgetId) — returns Map<accountId, include> for accounts where the user has an explicit preference
 * - setAccountAvailableInclusion(userId, budgetId, accountId, include) — stores or removes a preference row; no-op if the value matches the default
 * - deleteAllUserAvailableOverrides(userId) — removes all availability preferences for a user (used by delete-all-data flow)
 * - getAllAccountIds() — system maintenance: returns all account IDs across all budgets (worker use only)
 * - recalculateAccountBalance(accountId) — system maintenance: recomputes a single account's balance from openingBalance + transaction history; returns the new balance
 * Types: AccountInsert, AccountUpdate, GetAccountsOpts, NetWorthSnapshot
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  financeAccounts,
  financeAccountAvailability,
  financeNetWorthSnapshots,
  financeTransactions,
} from '../../db/schema/finances';
import { omitUndefined } from '../../utils';
import { hasAccessToBudget } from './budgets';
import type { FinanceAccount, NewFinanceAccount } from '../../types';
import { AccountTypes, TransactionTypes, LIABILITY_ACCOUNT_TYPES, type AccountType } from '../../constants';

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

// Default-included account types. All others are excluded unless overridden.
export const AVAILABLE_DEFAULT_INCLUDED_TYPES = new Set<AccountType>([AccountTypes.Bank, AccountTypes.Cash]);

// Re-exported from constants so hub server routes don't need to import from two places.
export { LIABILITY_ACCOUNT_TYPES as LIABILITY_TYPES } from '../../constants';

/** Returns true if an account of the given type is included in available balance by default. */
export function isDefaultIncludedInAvailable(type: AccountType): boolean {
  return AVAILABLE_DEFAULT_INCLUDED_TYPES.has(type);
}

/** Resolves effective inclusion: uses the explicit preference if set, otherwise falls back to the default. */
export function isIncludedInAvailable(type: AccountType, preferredInclude: boolean | null | undefined): boolean {
  return preferredInclude ?? isDefaultIncludedInAvailable(type);
}

/** Returns the available balance for a user: sum of included, non-archived account balances. Liabilities subtracted. */
export async function getAvailableBalance(userId: string, budgetId: number): Promise<number> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const rows = await db
    .select({
      balance: financeAccounts.balance,
      type: financeAccounts.type,
      preferredInclude: financeAccountAvailability.include,
    })
    .from(financeAccounts)
    .leftJoin(
      financeAccountAvailability,
      and(eq(financeAccountAvailability.accountId, financeAccounts.id), eq(financeAccountAvailability.userId, userId)),
    )
    .where(and(eq(financeAccounts.budgetId, budgetId), eq(financeAccounts.archived, false)));

  let available = 0;
  for (const row of rows) {
    if (!isIncludedInAvailable(row.type, row.preferredInclude)) continue;
    available += LIABILITY_ACCOUNT_TYPES.has(row.type) ? -row.balance : row.balance;
  }
  return available;
}

/** Returns a map of accountId → explicit include preference for accounts where the user has set one. */
export async function getAvailabilityPreferences(userId: string, budgetId: number): Promise<Map<number, boolean>> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const rows = await db
    .select({ accountId: financeAccountAvailability.accountId, include: financeAccountAvailability.include })
    .from(financeAccountAvailability)
    .innerJoin(financeAccounts, eq(financeAccountAvailability.accountId, financeAccounts.id))
    .where(and(eq(financeAccountAvailability.userId, userId), eq(financeAccounts.budgetId, budgetId)));

  return new Map(rows.map(r => [r.accountId, r.include]));
}

/**
 * Explicitly sets whether an account is included in available balance.
 * Upserts a preference row when the value differs from the default; deletes it when it matches (restoring default).
 */
export async function setAccountAvailableInclusion(
  userId: string,
  budgetId: number,
  accountId: number,
  include: boolean,
): Promise<void> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const [account] = await db
    .select({ type: financeAccounts.type })
    .from(financeAccounts)
    .where(and(eq(financeAccounts.id, accountId), eq(financeAccounts.budgetId, budgetId)));
  if (!account) throw new Error('Account not found');

  if (include !== isDefaultIncludedInAvailable(account.type)) {
    await db
      .insert(financeAccountAvailability)
      .values({ userId, accountId, include })
      .onConflictDoUpdate({
        target: [financeAccountAvailability.userId, financeAccountAvailability.accountId],
        set: { include },
      });
  } else {
    await db
      .delete(financeAccountAvailability)
      .where(and(eq(financeAccountAvailability.userId, userId), eq(financeAccountAvailability.accountId, accountId)));
  }
}

/** Removes all availability preferences for a user. Used by delete-all-data flow. */
export async function deleteAllUserAvailableOverrides(userId: string): Promise<void> {
  await db.delete(financeAccountAvailability).where(eq(financeAccountAvailability.userId, userId));
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
