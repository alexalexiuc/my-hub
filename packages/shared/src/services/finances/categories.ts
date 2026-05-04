/**
 * Finance category and group CRUD
 * Groups:
 * - createGroup(userId, budgetId, data) — creates a category group inside a budget
 * - getGroups(userId, budgetId) — lists all groups with their categories
 * - updateGroup(userId, budgetId, groupId, data) — partial update
 * - deleteGroup(userId, budgetId, groupId) — hard delete; categories become ungrouped
 * Categories:
 * - createCategory(userId, budgetId, data) — creates a category
 * - getCategories(userId, budgetId) — lists all categories for a budget
 * - getCategoryById(userId, budgetId, categoryId) — single category with access check
 * - updateCategory(userId, budgetId, categoryId, data) — partial update
 * - deleteCategory(userId, budgetId, categoryId) — hard delete
 * Types: GroupInsert, GroupUpdate, CategoryInsert, CategoryUpdate
 */
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { financeCategories, financeGroups } from '../../db/schema/finances';
import { omitNullish } from '../../utils';
import { verifyBudgetAccess } from './budgets';
import type { FinanceCategory, FinanceGroup, NewFinanceCategory, NewFinanceGroup } from '../../types';

export type GroupInsert = Omit<NewFinanceGroup, 'id' | 'budgetId' | 'createdAt' | 'updatedAt'>;
export type GroupUpdate = Partial<Pick<GroupInsert, 'name' | 'sortOrder'>>;

export type CategoryInsert = Omit<NewFinanceCategory, 'id' | 'budgetId' | 'createdAt' | 'updatedAt'>;
export type CategoryUpdate = Partial<
  Pick<CategoryInsert, 'name' | 'groupId' | 'color' | 'icon' | 'monthlyTarget' | 'sortOrder'>
>;

// ─── Groups ───────────────────────────────────────────────────────────────────

export async function createGroup(userId: string, budgetId: number, data: GroupInsert): Promise<FinanceGroup> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const [row] = await db
    .insert(financeGroups)
    .values({ ...data, budgetId })
    .returning();

  if (!row) throw new Error('Insert did not return a row');
  return row;
}

export async function getGroups(userId: string, budgetId: number): Promise<FinanceGroup[]> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  return db
    .select()
    .from(financeGroups)
    .where(eq(financeGroups.budgetId, budgetId))
    .orderBy(asc(financeGroups.sortOrder), asc(financeGroups.name));
}

export async function updateGroup(
  userId: string,
  budgetId: number,
  groupId: number,
  data: GroupUpdate,
): Promise<FinanceGroup> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const [row] = await db
    .update(financeGroups)
    .set({ ...omitNullish(data), updatedAt: new Date() })
    .where(and(eq(financeGroups.id, groupId), eq(financeGroups.budgetId, budgetId)))
    .returning();

  if (!row) throw new Error('Group not found');
  return row;
}

export async function deleteGroup(userId: string, budgetId: number, groupId: number): Promise<void> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  await db.delete(financeGroups).where(and(eq(financeGroups.id, groupId), eq(financeGroups.budgetId, budgetId)));
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function createCategory(userId: string, budgetId: number, data: CategoryInsert): Promise<FinanceCategory> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const [row] = await db
    .insert(financeCategories)
    .values({ ...data, budgetId })
    .returning();

  if (!row) throw new Error('Insert did not return a row');
  return row;
}

export async function getCategories(userId: string, budgetId: number): Promise<FinanceCategory[]> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  return db
    .select()
    .from(financeCategories)
    .where(eq(financeCategories.budgetId, budgetId))
    .orderBy(asc(financeCategories.sortOrder), asc(financeCategories.name));
}

export async function getCategoryById(
  userId: string,
  budgetId: number,
  categoryId: number,
): Promise<FinanceCategory | null> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const [row] = await db
    .select()
    .from(financeCategories)
    .where(and(eq(financeCategories.id, categoryId), eq(financeCategories.budgetId, budgetId)));

  return row ?? null;
}

export async function updateCategory(
  userId: string,
  budgetId: number,
  categoryId: number,
  data: CategoryUpdate,
): Promise<FinanceCategory> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const [row] = await db
    .update(financeCategories)
    .set({ ...omitNullish(data), updatedAt: new Date() })
    .where(and(eq(financeCategories.id, categoryId), eq(financeCategories.budgetId, budgetId)))
    .returning();

  if (!row) throw new Error('Category not found');
  return row;
}

export async function deleteCategory(userId: string, budgetId: number, categoryId: number): Promise<void> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  await db
    .delete(financeCategories)
    .where(and(eq(financeCategories.id, categoryId), eq(financeCategories.budgetId, budgetId)));
}
