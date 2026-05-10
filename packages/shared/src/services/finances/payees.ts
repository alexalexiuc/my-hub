/**
 * Finance payee CRUD + usage stats
 * - upsertPayee(userId, budgetId, name) — insert-or-return, case-insensitive via canonical name or aliases
 * - getPayees(userId, budgetId) — returns all payees ranked by user usage; includes aliases, notes, description, and stats
 * - updatePayee(userId, budgetId, payeeId, data) — updates payee aliases/notes after conflict checks
 * - deletePayee(userId, budgetId, payeeId) — hard delete
 * - incrementPayeeStats(tx, payeeId, userId, categoryId, accountId?) — called inside transaction writes
 * - decrementPayeeStats(tx, payeeId, userId) — called inside transaction deletes
 * Types: Payee
 */
import { and, asc, eq } from 'drizzle-orm';
import { db, DbTx } from '../../db/client';
import { financePayees } from '../../db/schema/finances';
import type { PayeeUserStats } from '../../db/schema/finances';
import { omitUndefined } from '../../utils';
import { hasAccessToBudget } from './budgets';
import type { FinancePayee } from '../../types';

export interface Payee {
  id: number;
  name: string;
  aliases: string[];
  notes: string | null;
  description: string | null;
  useCount: number;
  lastUsedAt: string | null;
  recentCategoryId: number | null;
  recentAccountId: number | null;
}

export type PayeeUpdate = Partial<Pick<FinancePayee, 'aliases' | 'notes'>>;

function normalizePayeeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Normalizes user-entered aliases by trimming, deduplicating case-insensitively,
 * and dropping aliases that would just repeat the canonical payee name.
 */
function sanitizeAliases(aliases: string[] | null | undefined, canonicalName: string): string[] {
  const canonicalNormalized = normalizePayeeName(canonicalName);
  const seen = new Set<string>();
  const sanitized: string[] = [];

  for (const alias of aliases ?? []) {
    const trimmed = alias.trim();
    const normalized = normalizePayeeName(trimmed);
    if (!trimmed || normalized === canonicalNormalized || seen.has(normalized)) continue;
    seen.add(normalized);
    sanitized.push(trimmed);
  }

  return sanitized;
}

function getPayeeIdentities(payee: Pick<FinancePayee, 'name' | 'normalizedName' | 'aliases'>): Set<string> {
  const identities = new Set<string>([payee.normalizedName]);
  for (const alias of payee.aliases ?? []) {
    const normalizedAlias = normalizePayeeName(alias);
    if (normalizedAlias) identities.add(normalizedAlias);
  }
  return identities;
}

export async function upsertPayee(userId: string, budgetId: number, name: string): Promise<FinancePayee> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const trimmedName = name.trim();
  const normalizedName = normalizePayeeName(trimmedName);

  const payees = await db
    .select()
    .from(financePayees)
    .where(eq(financePayees.budgetId, budgetId))
    .orderBy(asc(financePayees.name));

  const existingByAlias = payees.find(payee => getPayeeIdentities(payee).has(normalizedName));
  if (existingByAlias) return existingByAlias;

  const [row] = await db
    .insert(financePayees)
    .values({ budgetId, name: trimmedName, normalizedName, aliases: [], notes: null, statsByUser: {} })
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
      aliases: p.aliases ?? [],
      notes: p.notes,
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

export async function updatePayee(
  userId: string,
  budgetId: number,
  payeeId: number,
  data: PayeeUpdate,
): Promise<FinancePayee> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const payees = await db
    .select()
    .from(financePayees)
    .where(eq(financePayees.budgetId, budgetId))
    .orderBy(asc(financePayees.name));

  const existing = payees.find(payee => payee.id === payeeId);
  if (!existing) throw new Error('Payee not found');

  const aliases = data.aliases !== undefined ? sanitizeAliases(data.aliases, existing.name) : undefined;

  if (aliases !== undefined) {
    const reservedIdentities = new Set(aliases.map(normalizePayeeName));
    for (const payee of payees) {
      if (payee.id === payeeId) continue;
      for (const identity of getPayeeIdentities(payee)) {
        if (reservedIdentities.has(identity)) {
          throw new Error(
            `Alias "${aliases.find(alias => normalizePayeeName(alias) === identity) ?? identity}" is already used by another payee`,
          );
        }
      }
    }
  }

  const [updated] = await db
    .update(financePayees)
    .set(
      omitUndefined({
        aliases,
        notes: data.notes !== undefined ? data.notes : undefined,
      }),
    )
    .where(and(eq(financePayees.id, payeeId), eq(financePayees.budgetId, budgetId)))
    .returning();

  if (!updated) throw new Error('Payee not found');
  return updated;
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
