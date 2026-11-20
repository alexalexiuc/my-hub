import { z } from 'zod';
import { noContent, route, routeHttpError } from '@/lib/api/route';
import { deletePortfolioNote, getUserActiveBudget, updatePortfolioNote } from '@my-hub/shared/services';
import { noteBodySchema } from '../route';

const ParamsSchema = z.object({ id: z.coerce.number().int().positive() });

async function requireBudget(userId: string) {
  const budget = await getUserActiveBudget(userId);
  if (!budget) routeHttpError(404, { error: 'No budget found' });
  return budget;
}

export const PUT = route({ params: ParamsSchema, body: noteBodySchema })(async ({ user, params, body }) => {
  const budget = await requireBudget(user.id);
  const note = await updatePortfolioNote(user.id, budget.id, params.id, body);
  return { note };
});

export const DELETE = route({ params: ParamsSchema })(async ({ user, params }) => {
  const budget = await requireBudget(user.id);
  await deletePortfolioNote(user.id, budget.id, params.id);
  return noContent();
});
