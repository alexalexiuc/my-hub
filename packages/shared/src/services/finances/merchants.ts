/**
 * Finance merchant CRUD
 * - upsertMerchant(userId, budgetId, name) — inserts or returns an existing merchant (case-sensitive); used for autofill
 * - getMerchants(userId, budgetId) — lists all merchants for autofill suggestions
 * - deleteMerchant(userId, budgetId, merchantId) — hard delete
 * Types: (no extra types — merchant inserts use name + budgetId)
 */
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { financeMerchants } from '../../db/schema/finances';
import { verifyBudgetAccess } from './budgets';
import type { FinanceMerchant } from '../../types';

export async function upsertMerchant(userId: string, budgetId: number, name: string): Promise<FinanceMerchant> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const [row] = await db.insert(financeMerchants).values({ budgetId, name }).onConflictDoNothing().returning();

  if (row) return row;

  // Row already existed — fetch it.
  const [existing] = await db
    .select()
    .from(financeMerchants)
    .where(and(eq(financeMerchants.budgetId, budgetId), eq(financeMerchants.name, name)));

  if (!existing) throw new Error('Merchant upsert failed');
  return existing;
}

export async function getMerchants(userId: string, budgetId: number): Promise<FinanceMerchant[]> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  return db
    .select()
    .from(financeMerchants)
    .where(eq(financeMerchants.budgetId, budgetId))
    .orderBy(asc(financeMerchants.name));
}

export async function deleteMerchant(userId: string, budgetId: number, merchantId: number): Promise<void> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  await db
    .delete(financeMerchants)
    .where(and(eq(financeMerchants.id, merchantId), eq(financeMerchants.budgetId, budgetId)));
}
