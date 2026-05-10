import { z } from 'zod';
import { route, routeHttpError, created } from '@/lib/api/route';
import { getUserActiveBudget, createGroup } from '@my-hub/shared/services';
import { groupMutationResponseSchema } from '../contracts';
import { trimOrNull } from '@my-hub/shared/utils';

const GroupCreateSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  notes: z.string().trim().nullable().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const POST = route({ body: GroupCreateSchema, response: groupMutationResponseSchema })(async ({
  user,
  body,
}) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const group = await createGroup(user.id, budget.id, {
    name: body.name.trim(),
    notes: trimOrNull(body.notes),
    sortOrder: body.sortOrder ?? 0,
  });

  return created(group);
});
