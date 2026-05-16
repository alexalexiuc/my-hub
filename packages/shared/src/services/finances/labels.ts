/**
 * Finance label autocomplete service
 * - getLabels(userId, budgetId) — list all known labels for the budget, alphabetically sorted
 * - syncLabels(userId, budgetId, labels) — upsert a set of label strings into the known-labels table
 */
import { asc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { financeLabels } from '../../db/schema/finances';
import { hasAccessToBudget } from './budgets';

export async function getLabels(userId: string, budgetId: number): Promise<string[]> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }
  const rows = await db
    .select({ label: financeLabels.label })
    .from(financeLabels)
    .where(eq(financeLabels.budgetId, budgetId))
    .orderBy(asc(financeLabels.label));
  return rows.map(r => r.label);
}

export async function syncLabels(userId: string, budgetId: number, labels: string[]): Promise<void> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }
  const unique = [...new Set(labels.map(l => l.trim()).filter(l => l.length > 0))];
  if (unique.length === 0) return;
  await db
    .insert(financeLabels)
    .values(unique.map(label => ({ budgetId, label })))
    .onConflictDoNothing();
}
