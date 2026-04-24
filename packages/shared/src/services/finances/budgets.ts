/**
 * Finance budget CRUD and access-control queries
 * - createBudget(userId, data) — creates a budget and adds the creator as its first member
 * - getUserBudgets(userId) — lists all budgets the user is a member of
 * - getBudgetById(userId, budgetId) — single budget with access check, null if not found or no access
 * - updateBudget(userId, budgetId, data) — partial update; requires budget membership
 * - deleteBudget(userId, budgetId) — hard delete; requires budget membership
 * - deleteAllUserFinanceBudgets(userId) — bulk delete owned budgets + remove from shared memberships
 * - verifyBudgetAccess(userId, budgetId) — returns true if user is a budget member
 * Types: BudgetInsert, BudgetUpdate
 */
import { and, eq, sql } from 'drizzle-orm';
import { PromiseCacheX } from 'promise-cachex';
import { db } from '../../db/client';
import { financeBudgets, financeBudgetMembers } from '../../db/schema/finances';
import { omitNullish } from '../../utils';
import type { FinanceBudget, NewFinanceBudget } from '../../types';

const budgetAccessCache = new PromiseCacheX<boolean>({ ttl: 300_000 });

export type BudgetInsert = Omit<NewFinanceBudget, 'id' | 'createdByUserId' | 'createdAt' | 'updatedAt'>;
export type BudgetUpdate = Partial<Pick<BudgetInsert, 'name' | 'defaultCurrency'>>;

export async function verifyBudgetAccess(userId: string, budgetId: number): Promise<boolean> {
  return budgetAccessCache.get(`${userId}:${budgetId}`, async () => {
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(financeBudgetMembers)
      .where(and(eq(financeBudgetMembers.userId, userId), eq(financeBudgetMembers.budgetId, budgetId)));

    return (row?.count ?? 0) > 0;
  });
}

export async function createBudget(userId: string, data: BudgetInsert): Promise<FinanceBudget> {
  const [budget] = await db
    .insert(financeBudgets)
    .values({ ...data, createdByUserId: userId })
    .returning();

  if (!budget) throw new Error('Insert did not return a row');

  await db.insert(financeBudgetMembers).values({ budgetId: budget.id, userId });

  return budget;
}

export async function getUserBudgets(userId: string): Promise<FinanceBudget[]> {
  return db
    .select({
      id: financeBudgets.id,
      name: financeBudgets.name,
      defaultCurrency: financeBudgets.defaultCurrency,
      createdByUserId: financeBudgets.createdByUserId,
      createdAt: financeBudgets.createdAt,
      updatedAt: financeBudgets.updatedAt,
    })
    .from(financeBudgets)
    .innerJoin(financeBudgetMembers, eq(financeBudgetMembers.budgetId, financeBudgets.id))
    .where(eq(financeBudgetMembers.userId, userId));
}

export async function getBudgetById(userId: string, budgetId: number): Promise<FinanceBudget | null> {
  const [row] = await db
    .select({
      id: financeBudgets.id,
      name: financeBudgets.name,
      defaultCurrency: financeBudgets.defaultCurrency,
      createdByUserId: financeBudgets.createdByUserId,
      createdAt: financeBudgets.createdAt,
      updatedAt: financeBudgets.updatedAt,
    })
    .from(financeBudgets)
    .innerJoin(financeBudgetMembers, eq(financeBudgetMembers.budgetId, financeBudgets.id))
    .where(and(eq(financeBudgets.id, budgetId), eq(financeBudgetMembers.userId, userId)));

  return row ?? null;
}

export async function updateBudget(userId: string, budgetId: number, data: BudgetUpdate): Promise<FinanceBudget> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const [row] = await db
    .update(financeBudgets)
    .set({ ...omitNullish(data), updatedAt: new Date() })
    .where(eq(financeBudgets.id, budgetId))
    .returning();

  if (!row) throw new Error('Update did not return a row');
  return row;
}

export async function deleteBudget(userId: string, budgetId: number): Promise<void> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  await db.delete(financeBudgets).where(eq(financeBudgets.id, budgetId));
}

export async function deleteAllUserFinanceBudgets(userId: string): Promise<void> {
  // Delete budgets the user created — cascade removes all child rows.
  await db.delete(financeBudgets).where(eq(financeBudgets.createdByUserId, userId));
  // Remove user from any remaining shared budget memberships.
  await db.delete(financeBudgetMembers).where(eq(financeBudgetMembers.userId, userId));
}
