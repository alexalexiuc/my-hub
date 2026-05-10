/**
 * Finance payee CRUD + usage stats
 * - findPayeeByNameOrAlias(userId, budgetId, name) — resolves a payee by canonical name or alias
 * - upsertPayee(userId, budgetId, name) — insert-or-return, case-insensitive via normalizedName/alias matching
 * - resolvePayeeIdByNameOrAlias(userId, budgetId, name) — resolves payee id or undefined
 * - updatePayee(userId, budgetId, payeeId, patch) — updates payee name/alias/description
 * - getPayees(userId, budgetId) — returns all payees ranked by user usage; includes alias, description, and stats
 * - deletePayee(userId, budgetId, payeeId) — hard delete
 * - incrementPayeeStats(tx, payeeId, userId, categoryId, accountId?) — called inside transaction writes
 * - decrementPayeeStats(tx, payeeId, userId) — called inside transaction deletes
 * Types: Payee
 */
import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db, DbTx } from '../../db/client';
import { financePayees, financeTransactions } from '../../db/schema/finances';
import type { PayeeUserStats } from '../../db/schema/finances';
import { hasAccessToBudget } from './budgets';
import type { FinancePayee } from '../../types';

export interface Payee {
  id: number;
  name: string;
  alias: string | null;
  description: string | null;
  useCount: number;
  lastUsedAt: string | null;
  recentCategoryId: number | null;
  recentAccountId: number | null;
}

export interface PayeeUpdate {
  name?: string;
  alias?: string | null;
  description?: string | null;
}

function normalizePayeeName(name: string): string {
  return name.trim().toLowerCase();
}

export async function findPayeeByNameOrAlias(
  userId: string,
  budgetId: number,
  name: string,
): Promise<FinancePayee | null> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const trimmedName = name.trim();
  if (!trimmedName) return null;

  const normalizedName = normalizePayeeName(trimmedName);

  const [existing] = await db
    .select()
    .from(financePayees)
    .where(
      and(
        eq(financePayees.budgetId, budgetId),
        or(eq(financePayees.normalizedName, normalizedName), ilike(financePayees.alias, trimmedName)),
      ),
    )
    .limit(1);

  return existing ?? null;
}

export async function upsertPayee(userId: string, budgetId: number, name: string): Promise<FinancePayee> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const trimmedName = name.trim();
  const normalizedName = normalizePayeeName(trimmedName);

  const existing = await findPayeeByNameOrAlias(userId, budgetId, trimmedName);
  if (existing) return existing;

  const [row] = await db
    .insert(financePayees)
    .values({ budgetId, name: trimmedName, alias: null, normalizedName, statsByUser: {} })
    .onConflictDoNothing()
    .returning();

  if (row) return row;

  const fallback = await findPayeeByNameOrAlias(userId, budgetId, trimmedName);
  if (!fallback) throw new Error('Payee upsert failed');
  return fallback;
}

export async function resolvePayeeIdByNameOrAlias(
  userId: string,
  budgetId: number,
  name: string,
): Promise<number | undefined> {
  const trimmedName = name.trim();
  if (!trimmedName) return undefined;

  const payee = await findPayeeByNameOrAlias(userId, budgetId, trimmedName);
  return payee?.id;
}

export async function updatePayee(
  userId: string,
  budgetId: number,
  payeeId: number,
  patch: PayeeUpdate,
): Promise<FinancePayee> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const changes: Partial<typeof financePayees.$inferInsert> = {};
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) throw new Error('Payee name is required');
    changes.name = trimmed;
    changes.normalizedName = normalizePayeeName(trimmed);
  }
  if (patch.alias !== undefined) {
    changes.alias = patch.alias?.trim() || null;
  }
  if (patch.description !== undefined) {
    changes.description = patch.description?.trim() || null;
  }

  const [updated] = await db
    .update(financePayees)
    .set(changes)
    .where(and(eq(financePayees.id, payeeId), eq(financePayees.budgetId, budgetId)))
    .returning();

  if (!updated) {
    throw new Error('Payee not found');
  }

  return updated;
}

export async function getPayees(userId: string, budgetId: number): Promise<Payee[]> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const payees = await db
    .select()
    .from(financePayees)
    .where(eq(financePayees.budgetId, budgetId))
    .orderBy(asc(financePayees.name));

  const suggestions: Payee[] = payees.map(p => {
    const stats: PayeeUserStats | undefined = p.statsByUser[userId];
    return {
      id: p.id,
      name: p.name,
      alias: p.alias,
      description: p.description,
      useCount: stats?.count ?? 0,
      lastUsedAt: stats?.lastUsedAt ?? null,
      recentCategoryId: stats?.lastUsedCategoryId ?? null,
      recentAccountId: stats?.lastUsedAccountId ?? null,
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
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  await db.delete(financePayees).where(and(eq(financePayees.id, payeeId), eq(financePayees.budgetId, budgetId)));
}

/**
 * Increments usage stats for a payee inside an open DB transaction.
 * Call this after inserting a transaction that has a payeeId.
 */
export async function incrementPayeeStats(
  tx: DbTx,
  payeeId: number,
  userId: string,
  categoryId: number | null,
  accountId: number | null = null,
): Promise<void> {
  const [payee] = await tx.select().from(financePayees).where(eq(financePayees.id, payeeId));
  if (!payee) return;

  const stats: PayeeUserStats = payee.statsByUser[userId] ?? {
    count: 0,
    lastUsedAt: null,
    lastUsedCategoryId: null,
    lastUsedAccountId: null,
  };
  const updated: PayeeUserStats = {
    count: stats.count + 1,
    lastUsedAt: new Date().toISOString(),
    lastUsedCategoryId: categoryId,
    lastUsedAccountId: accountId,
  };

  await tx
    .update(financePayees)
    .set({ statsByUser: { ...payee.statsByUser, [userId]: updated } })
    .where(eq(financePayees.id, payeeId));
}

export interface MergePayeesResult {
  mergedCount: number;
  targetId: number;
  canonicalName: string;
}

/**
 * Merges one or more source payees into a target payee.
 * All transactions referencing the source payees are reassigned to targetId,
 * then the source payees are deleted. Optionally renames the target payee.
 */
export async function mergePayees(
  userId: string,
  budgetId: number,
  targetId: number,
  sourceIds: number[],
  canonicalName?: string,
): Promise<MergePayeesResult> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  if (sourceIds.length === 0) {
    throw new Error('At least one sourceId is required');
  }
  if (sourceIds.includes(targetId)) {
    throw new Error('targetId must not be in sourceIds');
  }

  const uniqueSourceIds = [...new Set(sourceIds)];
  if (uniqueSourceIds.length !== sourceIds.length) {
    throw new Error('sourceIds must not contain duplicates');
  }

  let mergedCount = 0;
  let finalCanonicalName = '';
  await db.transaction(async tx => {
    const [target] = await tx
      .select({ id: financePayees.id, name: financePayees.name })
      .from(financePayees)
      .where(and(eq(financePayees.id, targetId), eq(financePayees.budgetId, budgetId)))
      .for('update');

    if (!target) {
      throw new Error(`Payee id ${targetId} not found`);
    }

    const sources = await tx
      .select({ id: financePayees.id })
      .from(financePayees)
      .where(and(inArray(financePayees.id, uniqueSourceIds), eq(financePayees.budgetId, budgetId)))
      .for('update');

    if (sources.length !== uniqueSourceIds.length) {
      const foundIds = new Set(sources.map(s => s.id));
      const missing = uniqueSourceIds.filter(id => !foundIds.has(id));
      throw new Error(`Payee ids not found: ${missing.join(', ')}`);
    }

    finalCanonicalName = target.name;

    // Count transactions affected
    const [countRow] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(financeTransactions)
      .where(and(eq(financeTransactions.budgetId, budgetId), inArray(financeTransactions.payeeId, uniqueSourceIds)));

    mergedCount = Number(countRow?.count ?? 0);

    // Reassign transactions
    if (mergedCount > 0) {
      await tx
        .update(financeTransactions)
        .set({ payeeId: targetId, updatedAt: new Date() })
        .where(and(eq(financeTransactions.budgetId, budgetId), inArray(financeTransactions.payeeId, uniqueSourceIds)));
    }

    // Recompute target stats from actual transactions to keep getPayees ranking accurate.
    const targetTransactions = await tx
      .select({
        addedByUserId: financeTransactions.addedByUserId,
        categoryId: financeTransactions.categoryId,
        accountId: financeTransactions.accountId,
        createdAt: financeTransactions.createdAt,
      })
      .from(financeTransactions)
      .where(and(eq(financeTransactions.budgetId, budgetId), eq(financeTransactions.payeeId, targetId)))
      .orderBy(asc(financeTransactions.addedByUserId), desc(financeTransactions.createdAt));

    const recomputedStats: Record<string, PayeeUserStats> = {};
    for (const row of targetTransactions) {
      const existing = recomputedStats[row.addedByUserId];
      const createdAtIso = row.createdAt.toISOString();

      if (!existing) {
        recomputedStats[row.addedByUserId] = {
          count: 1,
          lastUsedAt: createdAtIso,
          lastUsedCategoryId: row.categoryId,
          lastUsedAccountId: row.accountId,
        };
        continue;
      }

      existing.count += 1;

      if (existing.lastUsedAt == null || createdAtIso > existing.lastUsedAt) {
        existing.lastUsedAt = createdAtIso;
        existing.lastUsedCategoryId = row.categoryId;
        existing.lastUsedAccountId = row.accountId;
      }
    }

    await tx
      .update(financePayees)
      .set({ statsByUser: recomputedStats })
      .where(and(eq(financePayees.id, targetId), eq(financePayees.budgetId, budgetId)));

    // Delete source payees
    await tx
      .delete(financePayees)
      .where(and(eq(financePayees.budgetId, budgetId), inArray(financePayees.id, uniqueSourceIds)));

    // Optionally rename target
    if (canonicalName !== undefined) {
      const trimmed = canonicalName.trim();
      if (!trimmed) throw new Error('canonicalName cannot be empty');
      finalCanonicalName = trimmed;
      await tx
        .update(financePayees)
        .set({ name: trimmed, normalizedName: normalizePayeeName(trimmed) })
        .where(and(eq(financePayees.id, targetId), eq(financePayees.budgetId, budgetId)));
    }
  });

  return { mergedCount, targetId, canonicalName: finalCanonicalName };
}

/**
 * Decrements usage stats for a payee inside an open DB transaction.
 * Call this when deleting a transaction that had a payeeId.
 */
export async function decrementPayeeStats(tx: DbTx, payeeId: number, userId: string): Promise<void> {
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
