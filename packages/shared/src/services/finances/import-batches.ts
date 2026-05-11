/**
 * Finance import batch management
 * - createImportBatch(userId, budgetId, id, filename, rowCount) — inserts a batch record with status 'completed'
 * - updateImportBatchCount(batchId, importedCount) — updates imported count after all rows inserted
 * - getImportBatches(userId, budgetId) — lists batches newest-first
 * - rollbackImportBatch(userId, budgetId, batchId) — deletes all linked transactions (balance reversal via deleteTransaction), marks batch as 'rolled_back'
 * Types: FinanceImportBatch
 */
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { financeImportBatches, financeTransactions } from '../../db/schema/finances';
import { hasAccessToBudget } from './budgets';
import { deleteTransaction } from './transactions';
import type { FinanceImportBatch } from '../../types';

export async function createImportBatch(
  userId: string,
  budgetId: number,
  id: string,
  filename: string,
  rowCount: number,
): Promise<FinanceImportBatch> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const [row] = await db
    .insert(financeImportBatches)
    .values({ id, budgetId, userId, filename, rowCount, importedCount: 0, status: 'completed' })
    .returning();

  if (!row) throw new Error('Insert did not return a row');
  return row;
}

export async function updateImportBatchCount(batchId: string, importedCount: number): Promise<void> {
  await db.update(financeImportBatches).set({ importedCount }).where(eq(financeImportBatches.id, batchId));
}

export async function getImportBatches(userId: string, budgetId: number): Promise<FinanceImportBatch[]> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  return db
    .select()
    .from(financeImportBatches)
    .where(and(eq(financeImportBatches.budgetId, budgetId), eq(financeImportBatches.userId, userId)))
    .orderBy(desc(financeImportBatches.createdAt));
}

export async function rollbackImportBatch(
  userId: string,
  budgetId: number,
  batchId: string,
): Promise<{ deletedCount: number }> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const [batch] = await db
    .select()
    .from(financeImportBatches)
    .where(
      and(
        eq(financeImportBatches.id, batchId),
        eq(financeImportBatches.budgetId, budgetId),
        eq(financeImportBatches.userId, userId),
      ),
    );

  if (!batch) throw new Error('Import batch not found');
  if (batch.status === 'rolled_back') throw new Error('Import batch already rolled back');

  const txns = await db
    .select({ id: financeTransactions.id })
    .from(financeTransactions)
    .where(and(eq(financeTransactions.importBatchId, batchId), eq(financeTransactions.budgetId, budgetId)));

  for (const txn of txns) {
    await deleteTransaction(userId, budgetId, txn.id);
  }

  await db.update(financeImportBatches).set({ status: 'rolled_back' }).where(eq(financeImportBatches.id, batchId));

  return { deletedCount: txns.length };
}
