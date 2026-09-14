/**
 * Finance account CRUD
 * - createAccount(userId, budgetId, data) — creates an account inside a budget the user can access
 * - getAccounts(userId, budgetId, opts?) — lists accounts; optionally include archived
 * - getAccountById(userId, budgetId, accountId) — single account with access check
 * - updateAccount(userId, budgetId, accountId, data) — partial update; data.showOnWidget/widgetSortOrder control whether a loan-type account gets a dedicated card on the finances widget and its display order
 * - deleteAccount(userId, budgetId, accountId) — hard delete
 * - getNetWorthHistory(userId, budgetId, limit?) — last N monthly net-worth snapshots, oldest-first
 * - getAvailableBalance(userId, budgetId) — sum of included non-archived account balances (liabilities subtracted). Default: bank+cash included, all others excluded. Per-user rows in financeAccountAvailability override the default.
 * - getAvailabilityPreferences(userId, budgetId) — returns Map<accountId, include> for accounts where the user has an explicit preference
 * - setAccountAvailableInclusion(userId, budgetId, accountId, include) — stores or removes a preference row; no-op if the value matches the default
 * - deleteAllUserAvailableOverrides(userId) — removes all availability preferences for a user (used by delete-all-data flow)
 * - getAllAccountIds() — system maintenance: returns all account IDs across all budgets (worker use only)
 * - getLedgerBalances(accountIds, opts?) — single source of truth for "balance computed from the ledger": batched across accounts, optionally date-bounded (opts.asOfDate); no auth, used by recalculateAccountBalance and reporting.ts's getAccountFlows
 * - recalculateAccountBalance(accountId) — system maintenance: recomputes balance from full transaction history via getLedgerBalances (corrections included); returns the new balance
 * Types: AccountInsert, AccountUpdate, GetAccountsOpts, NetWorthSnapshot
 */
import { and, desc, eq, inArray, lte, sql } from 'drizzle-orm';
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
    | 'name'
    | 'description'
    | 'type'
    | 'currency'
    | 'balance'
    | 'archived'
    | 'details'
    | 'showOnWidget'
    | 'widgetSortOrder'
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
export async function deleteAllUserAvailableOverrides(userId: string): Promise<number> {
  const deleted = await db
    .delete(financeAccountAvailability)
    .where(eq(financeAccountAvailability.userId, userId))
    .returning({ id: financeAccountAvailability.accountId });
  return deleted.length;
}

/** System maintenance: returns all account IDs across all budgets. No auth required — worker use only. */
export async function getAllAccountIds(): Promise<number[]> {
  const rows = await db.select({ id: financeAccounts.id }).from(financeAccounts);
  return rows.map(r => r.id);
}

/**
 * Single source of truth for "an account's balance, computed from the ledger": batches the
 * income/expense/transfer sign logic across any number of accounts, optionally bounded to
 * transactions on or before asOfDate (full history when omitted). Correction transactions are
 * always included — they represent intentional balance adjustments and must be part of the
 * running total.
 *
 * Balance formula per account:
 *   SUM(income transactions where accountId = account.id: amount)
 *   - SUM(expense/transfer transactions where accountId = account.id: amount)
 *   + SUM(transfer transactions where toAccountId = account.id: amount * toExchangeRate)
 *
 * No user auth required — callers (recalculateAccountBalance, reporting.ts's getAccountFlows)
 * are expected to have already scoped accountIds to a budget the caller can access.
 */
export async function getLedgerBalances(
  accountIds: number[],
  opts: { asOfDate?: string } = {},
): Promise<Map<number, number>> {
  if (accountIds.length === 0) return new Map();

  const fromConditions = [inArray(financeTransactions.accountId, accountIds)];
  const toConditions = [
    eq(financeTransactions.type, TransactionTypes.Transfer),
    inArray(financeTransactions.toAccountId, accountIds),
  ];
  if (opts.asOfDate) {
    fromConditions.push(lte(financeTransactions.date, opts.asOfDate));
    toConditions.push(lte(financeTransactions.date, opts.asOfDate));
  }

  const [fromRows, toRows] = await Promise.all([
    db
      .select({
        accountId: financeTransactions.accountId,
        net: sql<number>`COALESCE(SUM(CASE WHEN ${financeTransactions.type} = ${TransactionTypes.Income} THEN ${financeTransactions.amount} ELSE -${financeTransactions.amount} END), 0)::float8`,
      })
      .from(financeTransactions)
      .where(and(...fromConditions))
      .groupBy(financeTransactions.accountId),
    db
      .select({
        accountId: financeTransactions.toAccountId,
        net: sql<number>`COALESCE(SUM(${financeTransactions.amount} * COALESCE(${financeTransactions.toExchangeRate}, 1)), 0)::float8`,
      })
      .from(financeTransactions)
      .where(and(...toConditions))
      .groupBy(financeTransactions.toAccountId),
  ]);

  const balances = new Map<number, number>();
  for (const row of fromRows) {
    balances.set(row.accountId, (balances.get(row.accountId) ?? 0) + row.net);
  }
  for (const row of toRows) {
    if (row.accountId == null) continue;
    balances.set(row.accountId, (balances.get(row.accountId) ?? 0) + row.net);
  }
  return balances;
}

/**
 * System maintenance: recomputes a single account's balance from scratch using the full
 * transaction history (including user corrections), via getLedgerBalances. No user auth
 * required — intended for use by the worker only.
 *
 * Returns the new balance, or null if the account does not exist.
 */
export async function recalculateAccountBalance(
  accountId: number,
): Promise<{ name: string; oldBalance: number; newBalance: number } | null> {
  const [account] = await db
    .select({
      name: financeAccounts.name,
      balance: financeAccounts.balance,
    })
    .from(financeAccounts)
    .where(eq(financeAccounts.id, accountId));

  if (!account) return null;

  const balances = await getLedgerBalances([accountId]);
  const newBalance = Math.round((balances.get(accountId) ?? 0) * 10000) / 10000;

  await db
    .update(financeAccounts)
    .set({ balance: newBalance, updatedAt: new Date() })
    .where(eq(financeAccounts.id, accountId));

  return { name: account.name, oldBalance: account.balance, newBalance };
}
