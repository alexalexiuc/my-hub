/**
 * Finance account CRUD
 * - createAccount(userId, budgetId, data) — creates an account inside a budget the user can access
 * - getAccounts(userId, budgetId, opts?) — lists accounts; optionally include archived
 * - getAccountById(userId, budgetId, accountId) — single account with access check
 * - updateAccount(userId, budgetId, accountId, data) — partial update; data.showOnWidget/widgetSortOrder control whether a loan-type account gets a dedicated card on the finances widget and its display order
 * - deleteAccount(userId, budgetId, accountId) — hard delete
 * - getNetWorthHistory(userId, budgetId, limit?) — last N monthly net-worth snapshots, oldest-first
 * - updateAccount also refuses a currency change once the account has transactions (accountHasTransactions)
 * - accountHasTransactions(accountId) — true when any transaction uses the account as source or destination
 * - convertBalanceToDefaultCurrency(balance, accountCurrency, defaultCurrency, today?, opts?) — current-rate conversion of a balance (reporting view) with the rate, its date and source; falls back to the account's last transfer rate (opts.accountId), else nulls — never throws
 * - getAvailableBalanceBreakdown(userId, budgetId) — included non-archived accounts, each converted to the budget currency at today's rate, plus the total (liabilities subtracted). Default: bank+cash included, all others excluded. Per-user rows in financeAccountAvailability override the default.
 * - getAvailableBalance(userId, budgetId) — the breakdown's total (budget currency)
 * - getAvailabilityPreferences(userId, budgetId) — returns Map<accountId, include> for accounts where the user has an explicit preference
 * - setAccountAvailableInclusion(userId, budgetId, accountId, include) — stores or removes a preference row; no-op if the value matches the default
 * - deleteAllUserAvailableOverrides(userId) — removes all availability preferences for a user (used by delete-all-data flow)
 * - getAllAccountIds() — system maintenance: returns all account IDs across all budgets (worker use only)
 * - getLedgerBalances(accountIds, opts?) — single source of truth for "balance computed from the ledger": batched across accounts, optionally date-bounded (opts.asOfDate); no auth, used by recalculateAccountBalance and reporting.ts's getAccountFlows
 * - recalculateAccountBalance(accountId) — system maintenance: recomputes balance from full transaction history via getLedgerBalances (corrections included); returns the new balance
 * Types: AccountInsert, AccountUpdate, GetAccountsOpts, NetWorthSnapshot, AccountBalanceConversion, AvailableBalanceAccount, AvailableBalanceBreakdown
 */
import { and, desc, eq, inArray, lte, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../db/client';
import {
  financeAccounts,
  financeAccountAvailability,
  financeBudgets,
  financeNetWorthSnapshots,
  financeTransactions,
} from '../../db/schema/finances';
import { currentDateString, logger, omitUndefined } from '../../utils';
import { getExchangeRateQuote } from './exchangeRates';
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

  if (data.currency !== undefined) {
    const [existing] = await db
      .select({ currency: financeAccounts.currency })
      .from(financeAccounts)
      .where(and(eq(financeAccounts.id, accountId), eq(financeAccounts.budgetId, budgetId)));
    if (!existing) throw new Error('Account not found');
    if (existing.currency !== data.currency && (await accountHasTransactions(accountId))) {
      throw new Error(
        `Cannot change the currency of an account that has transactions (balances and history are in ${existing.currency}). ` +
          'Create a new account in the new currency and transfer the balance instead.',
      );
    }
  }

  const [row] = await db
    .update(financeAccounts)
    .set({ ...omitUndefined(data), updatedAt: new Date() })
    .where(and(eq(financeAccounts.id, accountId), eq(financeAccounts.budgetId, budgetId)))
    .returning();

  if (!row) throw new Error('Account not found');
  return row;
}

/** True when any transaction uses the account as source or transfer destination. */
export async function accountHasTransactions(accountId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: financeTransactions.id })
    .from(financeTransactions)
    .where(or(eq(financeTransactions.accountId, accountId), eq(financeTransactions.toAccountId, accountId)))
    .limit(1);
  return row != null;
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

export interface AccountBalanceConversion {
  /** Budget default currency per one unit of the account currency (1 for default-currency accounts); null when no rate is known at all. */
  rate: number | null;
  /** YYYY-MM-DD the rate applies to; null when no rate is known. */
  rateDate: string | null;
  /** Where the rate came from: a market quote, or the account's last transfer with a default-currency account. */
  rateSource: 'market' | 'transfer' | null;
  /** balance × rate, in the budget default currency; null when no rate is known (left out of totals). */
  balanceInDefaultCurrency: number | null;
}

/**
 * Last effective rate (default currency per unit of the account currency) from a transfer between
 * this account and an account in the default currency — e.g. the MDL→EUR purchase that funded a
 * EUR wallet. Used when no market rate is known at all.
 */
async function getLastTransferRate(
  accountId: number,
  defaultCurrency: string,
): Promise<{ rate: number; rateDate: string } | null> {
  const other = alias(financeAccounts, 'other_acct');
  const toLeg = sql`COALESCE(${financeTransactions.toAmount}, ${financeTransactions.amount} * COALESCE(${financeTransactions.toExchangeRate}, 1))`;
  const [outgoing, incoming] = await Promise.all([
    // foreign → default: rate = received (default) / sent (foreign)
    db
      .select({
        date: financeTransactions.date,
        foreign: financeTransactions.amount,
        def: sql<number>`${toLeg}::float8`,
      })
      .from(financeTransactions)
      .innerJoin(other, eq(other.id, financeTransactions.toAccountId))
      .where(
        and(
          eq(financeTransactions.type, TransactionTypes.Transfer),
          eq(financeTransactions.accountId, accountId),
          eq(other.currency, defaultCurrency as never),
        ),
      )
      .orderBy(desc(financeTransactions.date), desc(financeTransactions.id))
      .limit(1),
    // default → foreign: rate = sent (default) / received (foreign)
    db
      .select({
        date: financeTransactions.date,
        def: financeTransactions.amount,
        foreign: sql<number>`${toLeg}::float8`,
      })
      .from(financeTransactions)
      .innerJoin(other, eq(other.id, financeTransactions.accountId))
      .where(
        and(
          eq(financeTransactions.type, TransactionTypes.Transfer),
          eq(financeTransactions.toAccountId, accountId),
          eq(other.currency, defaultCurrency as never),
        ),
      )
      .orderBy(desc(financeTransactions.date), desc(financeTransactions.id))
      .limit(1),
  ]);
  const latest = [outgoing[0], incoming[0]]
    .filter((r): r is NonNullable<typeof r> => r != null && Number(r.foreign) > 0)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return latest ? { rate: Number(latest.def) / Number(latest.foreign), rateDate: latest.date } : null;
}

/**
 * Converts an account balance into the budget default currency at the current (today's) rate —
 * a reporting view only; balances themselves always stay in the account's currency. Uses the
 * nearest known market rate when today's is not available yet (and says which date it used);
 * when no market rate is known at all, the account's last transfer with a default-currency
 * account (opts.accountId); otherwise returns nulls instead of failing the page.
 */
export async function convertBalanceToDefaultCurrency(
  balance: number,
  accountCurrency: string,
  defaultCurrency: string,
  today: string = currentDateString(),
  opts: { accountId?: number } = {},
): Promise<AccountBalanceConversion> {
  if (accountCurrency === defaultCurrency) {
    return { rate: 1, rateDate: today, rateSource: 'market', balanceInDefaultCurrency: balance };
  }
  const toResult = (rate: number, rateDate: string, rateSource: 'market' | 'transfer'): AccountBalanceConversion => ({
    rate,
    rateDate,
    rateSource,
    balanceInDefaultCurrency: Math.round(balance * rate * 100) / 100,
  });
  try {
    const quote = await getExchangeRateQuote(accountCurrency, defaultCurrency, today, { maxAgeDays: Infinity });
    return toResult(quote.rate, quote.rateDate, 'market');
  } catch (err) {
    const fromTransfer = opts.accountId != null ? await getLastTransferRate(opts.accountId, defaultCurrency) : null;
    if (fromTransfer) return toResult(fromTransfer.rate, fromTransfer.rateDate, 'transfer');
    logger.warn(`[finances] ${(err as Error).message} — balance shown without a ${defaultCurrency} value`);
    return { rate: null, rateDate: null, rateSource: null, balanceInDefaultCurrency: null };
  }
}

export interface AvailableBalanceAccount extends AccountBalanceConversion {
  accountId: number;
  name: string;
  currency: string;
  /** In the account's own currency; negative contribution for liabilities is applied in the total only. */
  balance: number;
  isLiability: boolean;
}

export interface AvailableBalanceBreakdown {
  /** Budget default currency. */
  currency: string;
  /** Sum of included accounts in the default currency (liabilities subtracted). */
  total: number;
  /** Included accounts only. */
  accounts: AvailableBalanceAccount[];
}

/**
 * Available balance for a user with a per-account breakdown: included, non-archived accounts,
 * each converted to the budget default currency at the current rate; liabilities subtracted.
 */
export async function getAvailableBalanceBreakdown(
  userId: string,
  budgetId: number,
): Promise<AvailableBalanceBreakdown> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const [budget] = await db
    .select({ defaultCurrency: financeBudgets.defaultCurrency })
    .from(financeBudgets)
    .where(eq(financeBudgets.id, budgetId));
  if (!budget) throw new Error('Budget not found');

  const rows = await db
    .select({
      id: financeAccounts.id,
      name: financeAccounts.name,
      currency: financeAccounts.currency,
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

  const accounts: AvailableBalanceAccount[] = [];
  let total = 0;
  for (const row of rows) {
    if (!isIncludedInAvailable(row.type, row.preferredInclude)) continue;
    const conversion = await convertBalanceToDefaultCurrency(
      row.balance,
      row.currency,
      budget.defaultCurrency,
      undefined,
      {
        accountId: row.id,
      },
    );
    const isLiability = LIABILITY_ACCOUNT_TYPES.has(row.type);
    const value = conversion.balanceInDefaultCurrency ?? 0; // no rate known → left out of the total
    total += isLiability ? -value : value;
    accounts.push({
      accountId: row.id,
      name: row.name,
      currency: row.currency,
      balance: row.balance,
      isLiability,
      ...conversion,
    });
  }
  return { currency: budget.defaultCurrency, total: Math.round(total * 100) / 100, accounts };
}

/** Returns the available balance for a user, in the budget default currency: see getAvailableBalanceBreakdown. */
export async function getAvailableBalance(userId: string, budgetId: number): Promise<number> {
  return (await getAvailableBalanceBreakdown(userId, budgetId)).total;
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
 *   + SUM(transfer transactions where toAccountId = account.id: toAmount — destination currency)
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
        net: sql<number>`COALESCE(SUM(COALESCE(${financeTransactions.toAmount}, ${financeTransactions.amount} * COALESCE(${financeTransactions.toExchangeRate}, 1))), 0)::float8`,
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
