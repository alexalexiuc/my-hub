/**
 * Finance budget CRUD and access-control queries
 * - createBudget(userId, data) — creates a budget and adds the creator as its first member (isActive: true)
 * - getUserBudgets(userId) — lists all budgets the user is a member of, with isActive status per user
 * - getUserActiveBudget(userId) — returns the user's active budget (isActive: true), null if none
 * - setActiveBudget(userId, budgetId) — deactivates all user memberships, activates the specified one
 * - getBudgetById(userId, budgetId) — single budget with access check, null if not found or no access
 * - getBudgetMembers(userId, budgetId) — lists members (id, email, name, joinedAt) with access check
 * - updateBudget(userId, budgetId, data) — partial update; requires budget membership
 * - deleteBudget(userId, budgetId) — hard delete; requires budget membership
 * - addBudgetMember(userId, budgetId, targetUserId) — adds a new member (inactive); requires budget membership; idempotent
 * - removeBudgetMember(userId, budgetId, targetUserId) — removes a member from the budget; requires membership; cannot remove creator
 * - deleteAllUserFinanceBudgets(userId) — bulk delete owned budgets + remove from shared memberships
 * - hasAccessToBudget(userId, budgetId) — returns true if user is a budget member
 * - enforceBudgetAccess(userId, budgetId) — throws if user is not a budget member
 * Types: BudgetInsert, BudgetUpdate, UserBudget
 */
import { and, eq, sql } from 'drizzle-orm';
import { PromiseCacheX } from 'promise-cachex';
import { db } from '../../db/client';
import { financeBudgets, financeBudgetMembers } from '../../db/schema/finances';
import { users } from '../../db/schema/users';
import { logger, omitUndefined } from '../../utils';
import type { FinanceBudget, NewFinanceBudget } from '../../types';

const budgetAccessCache = new PromiseCacheX<boolean>({ ttl: 300_000 });
const budgetsCache = new PromiseCacheX<UserBudget[]>({ ttl: 300_000 });

export type BudgetInsert = Omit<NewFinanceBudget, 'id' | 'createdByUserId' | 'createdAt' | 'updatedAt'>;
export type BudgetUpdate = Partial<Pick<BudgetInsert, 'name' | 'defaultCurrency'>>;

/** Budget enriched with the requesting user's membership status. */
export interface UserBudget extends FinanceBudget {
  isActive: boolean;
}

/** Returns true if the user has access to the specified budget. */
export async function hasAccessToBudget(userId: string, budgetId: number): Promise<boolean> {
  return budgetAccessCache.get(`${userId}:${budgetId}`, async () => {
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(financeBudgetMembers)
      .where(and(eq(financeBudgetMembers.userId, userId), eq(financeBudgetMembers.budgetId, budgetId)));

    return (row?.count ?? 0) > 0;
  });
}

/** Throws if the user does not have access to the specified budget. */
export async function enforceBudgetAccess(userId: string, budgetId: number): Promise<void> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    logger.warn(`Unauthorized access attempt by user ${userId} to budget ${budgetId}`);
    throw new Error('Budget not found');
  }
}

export async function createBudget(userId: string, data: BudgetInsert): Promise<FinanceBudget> {
  const [budget] = await db
    .insert(financeBudgets)
    .values({ ...data, createdByUserId: userId })
    .returning();

  if (!budget) throw new Error('Insert did not return a row');

  // Deactivate any existing active memberships so only one budget is active at a time
  await db.update(financeBudgetMembers).set({ isActive: false }).where(eq(financeBudgetMembers.userId, userId));
  await db.insert(financeBudgetMembers).values({ budgetId: budget.id, userId, isActive: true });

  // Invalidate caches
  budgetsCache.delete(userId);
  budgetAccessCache.delete(`${userId}:${budget.id}`);

  return budget;
}

export async function getUserBudgets(userId: string): Promise<UserBudget[]> {
  return budgetsCache.get(userId, async () => {
    return db
      .select({
        id: financeBudgets.id,
        name: financeBudgets.name,
        defaultCurrency: financeBudgets.defaultCurrency,
        createdByUserId: financeBudgets.createdByUserId,
        createdAt: financeBudgets.createdAt,
        updatedAt: financeBudgets.updatedAt,
        isActive: financeBudgetMembers.isActive,
      })
      .from(financeBudgets)
      .innerJoin(financeBudgetMembers, eq(financeBudgetMembers.budgetId, financeBudgets.id))
      .where(eq(financeBudgetMembers.userId, userId));
  });
}

export async function getUserActiveBudget(userId: string): Promise<FinanceBudget | null> {
  const budgets = await getUserBudgets(userId);
  return budgets.find(b => b.isActive) ?? null;
}

export async function setActiveBudget(userId: string, budgetId: number): Promise<void> {
  await enforceBudgetAccess(userId, budgetId);

  // Deactivate all memberships for this user, then activate the chosen one
  await db.update(financeBudgetMembers).set({ isActive: false }).where(eq(financeBudgetMembers.userId, userId));

  await db
    .update(financeBudgetMembers)
    .set({ isActive: true })
    .where(and(eq(financeBudgetMembers.userId, userId), eq(financeBudgetMembers.budgetId, budgetId)));

  budgetsCache.delete(userId);
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
  await enforceBudgetAccess(userId, budgetId);

  const [row] = await db
    .update(financeBudgets)
    .set({ ...omitUndefined(data), updatedAt: new Date() })
    .where(eq(financeBudgets.id, budgetId))
    .returning();

  if (!row) throw new Error('Update did not return a row');

  budgetsCache.delete(userId);

  return row;
}

export async function deleteBudget(userId: string, budgetId: number): Promise<void> {
  await enforceBudgetAccess(userId, budgetId);

  // Snapshot members before deletion so we can invalidate their caches after
  const members = await db
    .select({ userId: financeBudgetMembers.userId })
    .from(financeBudgetMembers)
    .where(eq(financeBudgetMembers.budgetId, budgetId));

  await db.delete(financeBudgets).where(eq(financeBudgets.id, budgetId));

  for (const m of members) {
    budgetsCache.delete(m.userId);
    budgetAccessCache.delete(`${m.userId}:${budgetId}`);
  }
}

export interface BudgetMember {
  userId: string;
  email: string;
  name: string | null;
  joinedAt: Date;
}

export async function getBudgetMembers(userId: string, budgetId: number): Promise<BudgetMember[]> {
  await enforceBudgetAccess(userId, budgetId);

  return db
    .select({ userId: users.id, email: users.email, name: users.name, joinedAt: financeBudgetMembers.joinedAt })
    .from(financeBudgetMembers)
    .innerJoin(users, eq(users.id, financeBudgetMembers.userId))
    .where(eq(financeBudgetMembers.budgetId, budgetId));
}

export async function addBudgetMember(userId: string, budgetId: number, targetUserId: string): Promise<void> {
  await enforceBudgetAccess(userId, budgetId);

  const [existing] = await db
    .select({ count: sql<number>`count(*)` })
    .from(financeBudgetMembers)
    .where(and(eq(financeBudgetMembers.userId, targetUserId), eq(financeBudgetMembers.budgetId, budgetId)));

  if ((existing?.count ?? 0) > 0) return; // already a member — idempotent

  // New members start inactive; they can activate via setActiveBudget
  await db.insert(financeBudgetMembers).values({ budgetId, userId: targetUserId, isActive: false });

  // Invalidate caches
  budgetAccessCache.delete(`${targetUserId}:${budgetId}`);
  budgetsCache.delete(targetUserId);
}

export async function removeBudgetMember(userId: string, budgetId: number, targetUserId: string): Promise<void> {
  await enforceBudgetAccess(userId, budgetId);

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
