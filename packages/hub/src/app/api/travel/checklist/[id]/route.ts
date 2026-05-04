import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { deleteChecklistItem, updateChecklistItem } from '@my-hub/shared/services';
const ChecklistUpdateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  done: z.boolean().optional(),
});

export const PATCH = route({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: ChecklistUpdateSchema,
})(async ({ user, params, body }) => {
  const item = await updateChecklistItem(user.id, params.id, { title: body.title, done: body.done });
  if (!item) routeHttpError(404, { error: 'Item not found' });
  return { item };
});

export const DELETE = route({ params: z.object({ id: z.coerce.number().int().positive() }) })(async ({
  user,
  params,
}) => {
  const item = await deleteChecklistItem(user.id, params.id);
  if (!item) routeHttpError(404, { error: 'Item not found' });
  return { item };
});
