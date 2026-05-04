/**
 * Finance account CRUD
 * - createAccount(userId, budgetId, data) — creates an account inside a budget the user can access
 * - getAccounts(userId, budgetId, opts?) — lists accounts; optionally include archived
 * - getAccountById(userId, budgetId, accountId) — single account with access check
 * - updateAccount(userId, budgetId, accountId, data) — partial update
 * - deleteAccount(userId, budgetId, accountId) — hard delete
 * - getNetWorthHistory(userId, budgetId, limit?) — last N monthly net-worth snapshots, oldest-first
 * Types: AccountInsert, AccountUpdate, GetAccountsOpts, NetWorthSnapshot
 */
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { financeAccounts, financeNetWorthSnapshots } from '../../db/schema/finances';
import { omitNullish } from '../../utils';
import { verifyBudgetAccess } from './budgets';
import type { FinanceAccount, NewFinanceAccount } from '../../types';

export interface NetWorthSnapshot {
  month: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
}

export type AccountInsert = Omit<NewFinanceAccount, 'id' | 'budgetId' | 'createdAt' | 'updatedAt'>;
export type AccountUpdate = Partial<
  Pick<AccountInsert, 'name' | 'type' | 'currency' | 'openingBalance' | 'balance' | 'archived' | 'details'>
>;

export interface GetAccountsOpts {
  includeArchived?: boolean;
}

export async function createAccount(userId: string, budgetId: number, data: AccountInsert): Promise<FinanceAccount> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
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
  if (!(await verifyBudgetAccess(userId, budgetId))) {
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
  if (!(await verifyBudgetAccess(userId, budgetId))) {
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
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const [row] = await db
    .update(financeAccounts)
    .set({ ...omitNullish(data), updatedAt: new Date() })
    .where(and(eq(financeAccounts.id, accountId), eq(financeAccounts.budgetId, budgetId)))
    .returning();

  if (!row) throw new Error('Account not found');
  return row;
}

export async function deleteAccount(userId: string, budgetId: number, accountId: number): Promise<void> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  await db
    .delete(financeAccounts)
    .where(and(eq(financeAccounts.id, accountId), eq(financeAccounts.budgetId, budgetId)));
}

export async function getNetWorthHistory(userId: string, budgetId: number, limit = 6): Promise<NetWorthSnapshot[]> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
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
