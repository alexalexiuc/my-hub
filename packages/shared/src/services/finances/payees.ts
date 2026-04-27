/**
 * Finance payee CRUD + usage stats
 * - upsertPayee(userId, budgetId, name) — insert-or-return, case-insensitive via normalizedName
 * - getPayees(userId, budgetId) — returns PayeeSuggestion[] ranked by this user's usage
 * - deletePayee(userId, budgetId, payeeId) — hard delete
 * - incrementPayeeStats(tx, payeeId, userId, categoryId) — called inside transaction writes
 * - decrementPayeeStats(tx, payeeId, userId) — called inside transaction deletes
 * Types: PayeeSuggestion
 */
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { financePayees } from '../../db/schema/finances';
import type { PayeeUserStats } from '../../db/schema/finances';
import { verifyBudgetAccess } from './budgets';
import type { FinancePayee } from '../../types';

export interface PayeeSuggestion {
  id: number;
  name: string;
  useCount: number;
  lastUsedAt: string | null;
  recentCategoryId: number | null;
}

export async function upsertPayee(userId: string, budgetId: number, name: string): Promise<FinancePayee> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const normalizedName = name.toLowerCase().trim();
  const trimmedName = name.trim();

  const [row] = await db
    .insert(financePayees)
    .values({ budgetId, name: trimmedName, normalizedName, statsByUser: {} })
    .onConflictDoNothing()
    .returning();

  if (row) return row;

  const [existing] = await db
    .select()
    .from(financePayees)
    .where(and(eq(financePayees.budgetId, budgetId), eq(financePayees.normalizedName, normalizedName)));

  if (!existing) throw new Error('Payee upsert failed');
  return existing;
}

export async function getPayees(userId: string, budgetId: number): Promise<PayeeSuggestion[]> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const payees = await db
    .select()
    .from(financePayees)
    .where(eq(financePayees.budgetId, budgetId))
    .orderBy(asc(financePayees.name));

  const suggestions: PayeeSuggestion[] = payees.map(p => {
    const stats: PayeeUserStats | undefined = p.statsByUser[userId];
    return {
      id: p.id,
      name: p.name,
      useCount: stats?.count ?? 0,
      lastUsedAt: stats?.lastUsedAt ?? null,
      recentCategoryId: stats?.lastUsedCategoryId ?? null,
    };
  });

  // useCount DESC, lastUsedAt DESC, name ASC
  suggestions.sort((a, b) => {
    if (b.useCount !== a.useCount) return b.useCount - a.useCount;
    if (b.lastUsedAt && a.lastUsedAt) return b.lastUsedAt.localeCompare(a.lastUsedAt);
    if (b.lastUsedAt) return 1;
    if (a.lastUsedAt) return -1;
    return a.name.localeCompare(b.name);
  });

  return suggestions;
}

export async function deletePayee(userId: string, budgetId: number, payeeId: number): Promise<void> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  await db.delete(financePayees).where(and(eq(financePayees.id, payeeId), eq(financePayees.budgetId, budgetId)));
}

/**
 * Increments usage stats for a payee inside an open DB transaction.
 * Call this after inserting a transaction that has a payeeId.
 */
export async function incrementPayeeStats(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  payeeId: number,
  userId: string,
  categoryId: number | null,
): Promise<void> {
  const [payee] = await tx.select().from(financePayees).where(eq(financePayees.id, payeeId));
  if (!payee) return;

  const stats: PayeeUserStats = payee.statsByUser[userId] ?? { count: 0, lastUsedAt: null, lastUsedCategoryId: null };
  const updated: PayeeUserStats = {
    count: stats.count + 1,
    lastUsedAt: new Date().toISOString(),
    lastUsedCategoryId: categoryId,
  };

  await tx
    .update(financePayees)
    .set({ statsByUser: { ...payee.statsByUser, [userId]: updated } })
    .where(eq(financePayees.id, payeeId));
}

/**
 * Decrements usage stats for a payee inside an open DB transaction.
 * Call this when deleting a transaction that had a payeeId.
 */
export async function decrementPayeeStats(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  payeeId: number,
  userId: string,
): Promise<void> {
  const [payee] = await tx.select().from(financePayees).where(eq(financePayees.id, payeeId));
  if (!payee) return;

  const stats: PayeeUserStats | undefined = payee.statsByUser[userId];
  if (!stats) return;

  const updated: PayeeUserStats = { ...stats, count: Math.max(stats.count - 1, 0) };

  await tx
    .update(financePayees)
    .set({ statsByUser: { ...payee.statsByUser, [userId]: updated } })
    .where(eq(financePayees.id, payeeId));
}
