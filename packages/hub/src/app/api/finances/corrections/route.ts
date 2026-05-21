import { z } from 'zod';
import { route, routeHttpError, created } from '@/lib/api/route';
import { getUserActiveBudget, addCorrectionTransaction, getTransactionListItemById } from '@my-hub/shared/services';
import type { TransactionMutationResponse } from '../transactions/route';
import { transactionMutationResponseSchema } from '../transactions/route';

const CorrectionCreateSchema = z.object({
  accountId: z.number().int().positive(),
  targetBalance: z.number(),
  date: z.string().min(1, 'date is required'),
  notes: z.string().optional(),
});

export const POST = route({ body: CorrectionCreateSchema, response: transactionMutationResponseSchema })(async ({
  user,
  body,
}) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const result = await addCorrectionTransaction(user.id, budget.id, {
    accountId: body.accountId,
    targetBalance: body.targetBalance,
    date: body.date,
    notes: body.notes?.trim() || null,
    source: 'hub',
  });

  if (result == null) {
    routeHttpError(400, { error: 'Account balance already matches the target — no correction needed' });
  }

  const listItem = (await getTransactionListItemById(user.id, budget.id, result.transaction.id)) ?? undefined;

  return created({ transaction: result.transaction, listItem } satisfies TransactionMutationResponse);
});
