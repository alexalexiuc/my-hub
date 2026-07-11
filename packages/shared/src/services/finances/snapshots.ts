/**
 * Finance balance snapshot writers/readers
 * - writeAccountBalanceSnapshots(date) — system maintenance: upserts one row per account into finance_account_balance_snapshots for the given date (worker use only)
 * - writeNetWorthSnapshot(budgetId, month) — system maintenance: computes and upserts one budget's net-worth snapshot for the given YYYY-MM month (worker use only)
 * - getAccountBalanceHistory(userId, budgetId, accountId, opts?) — access-checked read of an account's daily balance history (opts: fromDate/toDate/limit), ordered oldest-first
 * Types: AccountBalanceHistoryPoint, GetAccountBalanceHistoryOpts
 */
import { and, asc, eq, gte, lte, type SQL } from 'drizzle-orm';
import { db } from '../../db/client';
import { financeAccountBalanceSnapshots, financeNetWorthSnapshots, financeAccounts } from '../../db/schema/finances';
import { computeNetWorthBreakdown } from '../../utils';
import { hasAccessToBudget } from './budgets';
import { getAllAccountsForSnapshot } from './accounts';
import type { SupportedCurrency } from '../../constants';

export interface AccountBalanceHistoryPoint {
  date: string;
  balance: number;
  currency: SupportedCurrency;
}

export interface GetAccountBalanceHistoryOpts {
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

/**
 * System maintenance: upserts one row per account into finance_account_balance_snapshots
 * for the given date, keyed on (accountId, date) so re-running the same day is idempotent.
 * No user auth required — intended for use by the worker only.
 */
export async function writeAccountBalanceSnapshots(date: string): Promise<{ written: number }> {
  const accounts = await getAllAccountsForSnapshot();

  for (const account of accounts) {
    await db
      .insert(financeAccountBalanceSnapshots)
      .values({
        budgetId: account.budgetId,
        accountId: account.id,
        date,
        balance: account.balance,
        currency: account.currency,
      })
      .onConflictDoUpdate({
        target: [financeAccountBalanceSnapshots.accountId, financeAccountBalanceSnapshots.date],
        set: { balance: account.balance, currency: account.currency },
      });
  }

  return { written: accounts.length };
}

/**
 * System maintenance: computes a budget's net worth from its current account balances
 * and upserts the snapshot row for the given YYYY-MM month, keyed on (budgetId, month).
 * No user auth required — intended for use by the worker only.
 */
export async function writeNetWorthSnapshot(budgetId: number, month: string): Promise<void> {
  const accounts = await db.select().from(financeAccounts).where(eq(financeAccounts.budgetId, budgetId));
  const { totalAssets, totalLiabilities, netWorth, breakdown } = computeNetWorthBreakdown(accounts);

  await db
    .insert(financeNetWorthSnapshots)
    .values({ budgetId, month, totalAssets, totalLiabilities, netWorth, breakdown })
    .onConflictDoUpdate({
      target: [financeNetWorthSnapshots.budgetId, financeNetWorthSnapshots.month],
      set: { totalAssets, totalLiabilities, netWorth, breakdown },
    });
}

/** Access-checked read of an account's daily balance history, ordered oldest-first. */
export async function getAccountBalanceHistory(
  userId: string,
  budgetId: number,
  accountId: number,
  opts: GetAccountBalanceHistoryOpts = {},
): Promise<AccountBalanceHistoryPoint[]> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const conditions: SQL[] = [
    eq(financeAccountBalanceSnapshots.budgetId, budgetId),
    eq(financeAccountBalanceSnapshots.accountId, accountId),
  ];
  if (opts.fromDate !== undefined) {
    conditions.push(gte(financeAccountBalanceSnapshots.date, opts.fromDate));
  }
  if (opts.toDate !== undefined) {
    conditions.push(lte(financeAccountBalanceSnapshots.date, opts.toDate));
  }

  let query = db
    .select({
      date: financeAccountBalanceSnapshots.date,
      balance: financeAccountBalanceSnapshots.balance,
      currency: financeAccountBalanceSnapshots.currency,
    })
    .from(financeAccountBalanceSnapshots)
    .where(and(...conditions))
    .orderBy(asc(financeAccountBalanceSnapshots.date));

  if (opts.limit !== undefined) {
    query = query.limit(opts.limit) as typeof query;
  }

  return query;
}
