import { z } from 'zod';
import { noContent, route, routeHttpError } from '@/lib/api/route';
import { deleteSupply, getUserActiveBudget, updateSupply } from '@my-hub/shared/services';
import { supplyBodySchema } from '../route';

const ParamsSchema = z.object({ id: z.coerce.number().int().positive() });

async function requireBudget(userId: string) {
  const budget = await getUserActiveBudget(userId);
  if (!budget) routeHttpError(404, { error: 'No budget found' });
  return budget;
}

export const PUT = route({ params: ParamsSchema, body: supplyBodySchema })(async ({ user, params, body }) => {
  const budget = await requireBudget(user.id);
  try {
    const supply = await updateSupply(user.id, budget.id, params.id, body);
    return { supply };
  } catch (err) {
    if (err instanceof Error && err.message === 'Supply not found') {
      routeHttpError(404, { error: 'Supply not found' });
    }
    throw err;
  }
});

export const DELETE = route({ params: ParamsSchema })(async ({ user, params }) => {
  const budget = await requireBudget(user.id);
  try {
    await deleteSupply(user.id, budget.id, params.id);
  } catch (err) {
    if (err instanceof Error && err.message === 'Supply not found') {
      routeHttpError(404, { error: 'Supply not found' });
    }
    throw err;
  }
  return noContent();
});
