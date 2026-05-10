import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { getUserActiveBudget, updatePayee } from '@my-hub/shared/services';
import { payeeMutationResponseSchema } from '../../contracts';

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

const PayeeUpdateSchema = z.object({
  aliases: z.array(z.string().trim().min(1)).optional(),
  notes: z.string().trim().nullable().optional(),
});

export const PATCH = route({
  params: paramsSchema,
  body: PayeeUpdateSchema,
  response: payeeMutationResponseSchema,
})(async ({ user, params, body }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  try {
    const payee = await updatePayee(user.id, budget.id, params.id, {
      aliases: body.aliases,
      notes: body.notes !== undefined ? body.notes : undefined,
    });

    return payee;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Payee not found') routeHttpError(404, { error: error.message });
      if (error.message.includes('already used by another payee')) routeHttpError(400, { error: error.message });
    }
    throw error;
  }
});
