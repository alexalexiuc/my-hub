/**
 * Finance payee CRUD
 * - upsertPayee(userId, budgetId, name) — inserts or returns an existing payee (case-sensitive); used for autofill
 * - getPayees(userId, budgetId) — lists all payees for autofill suggestions
 * - deletePayee(userId, budgetId, payeeId) — hard delete
 * Types: (no extra types — payee inserts use name + budgetId)
 */
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { financePayees } from '../../db/schema/finances';
import { verifyBudgetAccess } from './budgets';
import type { FinancePayee } from '../../types';

export async function upsertPayee(userId: string, budgetId: number, name: string): Promise<FinancePayee> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const [row] = await db.insert(financePayees).values({ budgetId, name }).onConflictDoNothing().returning();

  if (row) return row;

  // Row already existed — fetch it.
  const [existing] = await db
    .select()
    .from(financePayees)
    .where(and(eq(financePayees.budgetId, budgetId), eq(financePayees.name, name)));

  if (!existing) throw new Error('Payee upsert failed');
  return existing;
}

export async function getPayees(userId: string, budgetId: number): Promise<FinancePayee[]> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  return db.select().from(financePayees).where(eq(financePayees.budgetId, budgetId)).orderBy(asc(financePayees.name));
}

export async function deletePayee(userId: string, budgetId: number, payeeId: number): Promise<void> {
  if (!(await verifyBudgetAccess(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  await db.delete(financePayees).where(and(eq(financePayees.id, payeeId), eq(financePayees.budgetId, budgetId)));
}
