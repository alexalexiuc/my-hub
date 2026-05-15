/**
 * Finance payee CRUD + usage stats
 * - findPayeeByNameOrAlias(userId, budgetId, name) — resolves a payee by canonical name or aliases
 * - upsertPayee(userId, budgetId, name) — insert-or-return, case-insensitive via normalizedName/aliases matching
 * - resolvePayeeIdByNameOrAlias(userId, budgetId, name) — resolves payee id or undefined
 * - updatePayee(userId, budgetId, payeeId, patch) — updates payee name/aliases/description
 * - getPayees(userId, budgetId) — returns all payees ranked by user usage; includes aliases, description, and stats
 * - deletePayee(userId, budgetId, payeeId) — hard delete
 * - incrementPayeeStats(tx, payeeId, userId, categoryId, accountId?) — called inside transaction writes
 * - decrementPayeeStats(tx, payeeId, userId) — called inside transaction deletes
 * Types: Payee
 */
import { and, asc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { financePayees, financeTransactions } from '../../db/schema/finances';
import { hasAccessToBudget } from './budgets';
import type { FinancePayee } from '../../types';
import { omitNullish } from '../../utils';

export interface Payee {
  id: number;
  name: string;
  aliases: string[];
  description: string | null;
}

export type PayeeStats = {
  useCount: number;
  lastUsedAt?: string;
  lastUsedCategoryId?: number;
  lastUsedAccountId?: number;
};

export type PayeeWithStats = Payee & PayeeStats;

export interface PayeeUpdate {
  name?: string;
  aliases?: string[];
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
        or(
          eq(financePayees.normalizedName, normalizedName),
          sql`LOWER(${financePayees.aliases}::TEXT)::JSONB ? ${trimmedName.toLowerCase()}`,
        ),
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
    .values({ budgetId, name: trimmedName, aliases: [], normalizedName })
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
  if (patch.aliases !== undefined) {
    changes.aliases = patch.aliases.map(a => a.trim()).filter(Boolean);
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

export async function getPayees(userId: string, budgetId: number): Promise<PayeeWithStats[]> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const payees = await db
    .select()
    .from(financePayees)
    .where(eq(financePayees.budgetId, budgetId))
    .orderBy(asc(financePayees.name));

  // get last 50 transactions to determine recent usage stats for payees.
  const recentTransactions = await db
    .select({
      payeeId: financeTransactions.payeeId,
      categoryId: financeTransactions.categoryId,
      accountId: financeTransactions.accountId,
      date: financeTransactions.date,
    })
    .from(financeTransactions)
    .where(and(eq(financeTransactions.budgetId, budgetId), eq(financeTransactions.addedByUserId, userId)))
    .orderBy(sql`created_at DESC`)
    .limit(50);

  const statsByPayeeId: Record<number, PayeeStats> = {};
  for (const tx of recentTransactions) {
    if (!tx.payeeId) continue;
    const existing = statsByPayeeId[tx.payeeId];
    if (!existing) {
      statsByPayeeId[tx.payeeId] = {
        useCount: 1,
        ...omitNullish({
          lastUsedAt: tx.date,
          lastUsedCategoryId: tx.categoryId,
          lastUsedAccountId: tx.accountId,
        }),
      };
    } else {
      existing.useCount! += 1;
      if (existing.lastUsedAt! < tx.date) {
        existing.lastUsedAt = tx.date;
        existing.lastUsedCategoryId = tx.categoryId || existing.lastUsedCategoryId;
        existing.lastUsedAccountId = tx.accountId || existing.lastUsedAccountId;
      }
    }
  }

  const withStats: PayeeWithStats[] = payees.map(p => {
    const stats = statsByPayeeId[p.id];
    return {
      id: p.id,
      name: p.name,
      aliases: p.aliases,
      description: p.description,
      useCount: 0,
      ...stats,
    };
  });

  // useCount DESC, lastUsedAt DESC, name ASC
  withStats.sort((a, b) => {
    if (b.useCount !== a.useCount) return b.useCount - a.useCount;
    if (b.lastUsedAt && a.lastUsedAt) return b.lastUsedAt.localeCompare(a.lastUsedAt);
    if (b.lastUsedAt) return 1;
    if (a.lastUsedAt) return -1;
    return a.name.localeCompare(b.name);
  });

  return withStats;
}

export async function deletePayee(userId: string, budgetId: number, payeeId: number): Promise<void> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  await db.delete(financePayees).where(and(eq(financePayees.id, payeeId), eq(financePayees.budgetId, budgetId)));
}

export interface MergePayeesResult {
  mergedCount: number;
  targetId: number;
  canonicalName: string;
}

/**
 * Merges one or more source payees into a target payee.
 * All transactions referencing the source payees are reassigned to targetId,
 * then the source payees are deleted. Source payee names and aliases are merged
 * into the target's alias list (deduplicated, case-insensitive). Optionally renames the target.
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
      .select({ id: financePayees.id, name: financePayees.name, aliases: financePayees.aliases })
      .from(financePayees)
      .where(and(eq(financePayees.id, targetId), eq(financePayees.budgetId, budgetId)))
      .for('update');

    if (!target) {
      throw new Error(`Payee id ${targetId} not found`);
    }

    const sources = await tx
      .select({ id: financePayees.id, name: financePayees.name, aliases: financePayees.aliases })
      .from(financePayees)
      .where(and(inArray(financePayees.id, uniqueSourceIds), eq(financePayees.budgetId, budgetId)))
      .for('update');

    if (sources.length !== uniqueSourceIds.length) {
      const foundIds = new Set(sources.map(s => s.id));
      const missing = uniqueSourceIds.filter(id => !foundIds.has(id));
      throw new Error(`Payee ids not found: ${missing.join(', ')}`);
    }

    finalCanonicalName = target.name;

    const seenNormalized = new Set<string>();
    const mergedAliases: string[] = [];
    for (const alias of [...(target.aliases ?? []), ...sources.flatMap(s => [s.name, ...(s.aliases ?? [])])]) {
      const norm = alias.trim().toLowerCase();
      if (!norm || seenNormalized.has(norm)) continue;
      seenNormalized.add(norm);
      mergedAliases.push(alias.trim());
    }
    const targetNameNorm = target.name.trim().toLowerCase();
    const finalAliases = mergedAliases.filter(a => a.toLowerCase() !== targetNameNorm);

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

    // Delete source payees
    await tx
      .delete(financePayees)
      .where(and(eq(financePayees.budgetId, budgetId), inArray(financePayees.id, uniqueSourceIds)));

    // Update target: apply merged aliases and optional rename
    const targetUpdates: Partial<typeof financePayees.$inferInsert> = { aliases: finalAliases };
    if (canonicalName !== undefined) {
      const trimmed = canonicalName.trim();
      if (!trimmed) throw new Error('canonicalName cannot be empty');
      finalCanonicalName = trimmed;
      targetUpdates.name = trimmed;
      targetUpdates.normalizedName = normalizePayeeName(trimmed);
    }
    await tx
      .update(financePayees)
      .set(targetUpdates)
      .where(and(eq(financePayees.id, targetId), eq(financePayees.budgetId, budgetId)));
  });

  return { mergedCount, targetId, canonicalName: finalCanonicalName };
}
