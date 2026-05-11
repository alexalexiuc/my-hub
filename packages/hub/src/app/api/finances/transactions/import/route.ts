import { randomUUID } from 'crypto';
import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import {
  getUserActiveBudget,
  addTransaction,
  upsertPayee,
  updatePayee,
  createImportBatch,
  updateImportBatchCount,
  getImportBatches,
} from '@my-hub/shared/services';
import type { TransactionInsert } from '@my-hub/shared/services';
import { TransactionTypes } from '@my-hub/shared/constants';
import { isPayeeRequired } from '@my-hub/shared/utils';

const ImportRowSchema = z.object({
  type: z.enum(Object.values(TransactionTypes) as [string, ...string[]]),
  date: z
    .string()
    .min(1, 'Date is required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  amount: z.number().positive(),
  accountId: z.number().int().positive(),
  toAccountId: z.number().int().positive().nullable().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  payeeId: z.number().int().positive().nullable().optional(),
  payeeName: z.string().optional(),
  // CSV raw value to register as alias when it differs from the canonical payeeName
  payeeAlias: z.string().optional(),
  notes: z.string().optional(),
});

const ImportRequestSchema = z.object({
  filename: z.string().min(1),
  rows: z.array(ImportRowSchema).min(1).max(1000),
});

const importResponseSchema = z.object({
  batchId: z.string(),
  importedCount: z.number().int(),
});

export const POST = route({ body: ImportRequestSchema, response: importResponseSchema })(async ({ user, body }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const batchId = randomUUID();
  await createImportBatch(user.id, budget.id, batchId, body.filename, body.rows.length);

  let importedCount = 0;

  for (const row of body.rows) {
    const type = row.type as TransactionInsert['type'];

    let payeeId: number | null = null;
    if (isPayeeRequired(type)) {
      if (row.payeeId != null) {
        payeeId = row.payeeId;
      } else if (row.payeeName?.trim()) {
        const payee = await upsertPayee(user.id, budget.id, row.payeeName.trim());
        payeeId = payee.id;
        // Register the CSV raw value as an alias if it differs from the canonical name
        if (row.payeeAlias?.trim() && row.payeeAlias.trim() !== row.payeeName.trim()) {
          const currentAliases = payee.aliases ?? [];
          if (!currentAliases.includes(row.payeeAlias.trim())) {
            await updatePayee(user.id, budget.id, payee.id, {
              aliases: [...currentAliases, row.payeeAlias.trim()],
            });
          }
        }
      }
    }

    const data: TransactionInsert = {
      type,
      accountId: row.accountId,
      toAccountId: row.toAccountId ?? null,
      amount: row.amount,
      date: row.date,
      categoryId: row.categoryId ?? null,
      payeeId,
      notes: row.notes?.trim() || null,
      isCorrection: false,
      source: 'import',
      importBatchId: batchId,
      fromAccountBalanceAfter: null,
      toAccountBalanceAfter: null,
      extras: null,
    };

    await addTransaction(user.id, budget.id, data);
    importedCount++;
  }

  await updateImportBatchCount(batchId, importedCount);

  return { batchId, importedCount };
});

const importBatchSchema = z.object({
  id: z.string(),
  filename: z.string(),
  rowCount: z.number().int(),
  importedCount: z.number().int(),
  status: z.string(),
  createdAt: z.string(),
});

const importBatchListResponseSchema = z.object({
  batches: z.array(importBatchSchema),
});

export const GET = route({ response: importBatchListResponseSchema })(async ({ user }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const rows = await getImportBatches(user.id, budget.id);
  return {
    batches: rows.map(b => ({
      id: b.id,
      filename: b.filename,
      rowCount: b.rowCount,
      importedCount: b.importedCount,
      status: b.status,
      createdAt: b.createdAt.toISOString(),
    })),
  };
});
