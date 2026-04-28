/**
 * Finance budget CRUD and access-control queries
 * - createBudget(userId, data) — creates a budget and adds the creator as its first member
 * - getUserBudgets(userId) — lists all budgets the user is a member of
 * - getUserActiveBudget(userId) — returns user's active budget
 * - getBudgetById(userId, budgetId) — single budget with access check, null if not found or no access
 * - getBudgetMembers(userId, budgetId) — lists members (id, email, name, joinedAt) with access check
 * - updateBudget(userId, budgetId, data) — partial update; requires budget membership
 * - deleteBudget(userId, budgetId) — hard delete; requires budget membership
 * - addBudgetMember(userId, budgetId, targetUserId) — adds a new member; requires budget membership; idempotent
 * - removeBudgetMember(userId, budgetId, targetUserId) — removes a member from the budget; requires membership; cannot remove creator
 * - deleteAllUserFinanceBudgets(userId) — bulk delete owned budgets + remove from shared memberships
 * - verifyBudgetAccess(userId, budgetId) — returns true if user is a budget member
 * Types: BudgetInsert, BudgetUpdate
 */
import { and, eq, sql } from 'drizzle-orm';
import { PromiseCacheX } from 'promise-cachex';
import { db } from '../../db/client';
import { financeBudgets, financeBudgetMembers } from '../../db/schema/finances';
import { users } from '../../db/schema/users';
import { omitNullish } from '../../utils';
import type { FinanceBudget, NewFinanceBudget } from '../../types';

const budgetAccessCache = new PromiseCacheX<boolean>({ ttl: 300_000 });
const budgetsCache = new PromiseCacheX<FinanceBudget[]>({ ttl: 300_000 });

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

  // Invalidate caches
  budgetsCache.delete(userId);
  budgetAccessCache.delete(`${userId}:${budget.id}`);

  return budget;
}

export async function getUserBudgets(userId: string): Promise<FinanceBudget[]> {
  return budgetsCache.get(userId, async () => {
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
  });
}

export async function getUserActiveBudget(userId: string): Promise<FinanceBudget | null> {
  const budgets = await getUserBudgets(userId);
  // for now we will only operate with a single budget per user, so just return the first one.
  return budgets[0] ?? null;
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

export interface BudgetMember {
  userId: string;
  email: string;
  name: string | null;
  joinedAt: Date;
}

export async function getBudgetMembers(userId: string, budgetId: number): Promise<BudgetMember[]> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  return db
    .select({ userId: users.id, email: users.email, name: users.name, joinedAt: financeBudgetMembers.joinedAt })
    .from(financeBudgetMembers)
    .innerJoin(users, eq(users.id, financeBudgetMembers.userId))
    .where(eq(financeBudgetMembers.budgetId, budgetId));
}

export async function addBudgetMember(userId: string, budgetId: number, targetUserId: string): Promise<void> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const [existing] = await db
    .select({ count: sql<number>`count(*)` })
    .from(financeBudgetMembers)
    .where(and(eq(financeBudgetMembers.userId, targetUserId), eq(financeBudgetMembers.budgetId, budgetId)));

  if ((existing?.count ?? 0) > 0) return; // already a member — idempotent

  await db.insert(financeBudgetMembers).values({ budgetId, userId: targetUserId });

  // Invalidate caches
  budgetAccessCache.delete(`${targetUserId}:${budgetId}`);
  budgetsCache.delete(targetUserId);
}

export async function removeBudgetMember(userId: string, budgetId: number, targetUserId: string): Promise<void> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const [budget] = await db
    .select({ createdByUserId: financeBudgets.createdByUserId })
    .from(financeBudgets)
    .where(eq(financeBudgets.id, budgetId));

  if (budget?.createdByUserId === targetUserId) {
    throw new Error('Cannot remove the budget creator');
  }

  await db
    .delete(financeBudgetMembers)
    .where(and(eq(financeBudgetMembers.budgetId, budgetId), eq(financeBudgetMembers.userId, targetUserId)));

  // Invalidate caches
  budgetAccessCache.delete(`${targetUserId}:${budgetId}`);
  budgetsCache.delete(targetUserId);
}

export async function deleteAllUserFinanceBudgets(userId: string): Promise<void> {
  // Delete budgets the user created — cascade removes all child rows.
  await db.delete(financeBudgets).where(eq(financeBudgets.createdByUserId, userId));
  // Remove user from any remaining shared budget memberships.
  await db.delete(financeBudgetMembers).where(eq(financeBudgetMembers.userId, userId));

  // Invalidate caches
  budgetsCache.delete(userId);
  budgetAccessCache
    .keys()
    .filter(key => key.startsWith(`${userId}:`))
    .forEach(key => budgetAccessCache.delete(key));
}
