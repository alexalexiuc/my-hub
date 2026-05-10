import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { getUserActiveBudget, updateGroup, deleteGroup } from '@my-hub/shared/services';
import { groupMutationResponseSchema } from '../../contracts';
import { trimOrNull } from '@my-hub/shared/utils';

const GroupUpdateSchema = z.object({
  name: z.string().trim().min(1, 'name is required').optional(),
  notes: z.string().trim().nullable().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const PATCH = route({ body: GroupUpdateSchema, params: IdParamSchema, response: groupMutationResponseSchema })(
  async ({ user, body, params }) => {
    const budget = await getUserActiveBudget(user.id);
    if (!budget) routeHttpError(404, { error: 'No budget found' });

    const group = await updateGroup(user.id, budget.id, params.id, {
      name: body.name,
      notes: trimOrNull(body.notes),
      sortOrder: body.sortOrder,
    });

    return group;
  },
);

const deleteResponseSchema = z.object({ id: z.number() });

export const DELETE = route({ params: IdParamSchema, response: deleteResponseSchema })(async ({ user, params }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  await deleteGroup(user.id, budget.id, params.id);
  return { id: params.id };
});
