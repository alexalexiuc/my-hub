import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { deleteTripCompanion, updateTripCompanion } from '@my-hub/shared/services';
const CompanionUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
import { trimOrNull } from '@my-hub/shared/utils';

export const PATCH = route({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: CompanionUpdateSchema,
})(async ({ user, params, body }) => {
  const companion = await updateTripCompanion(user.id, params.id, {
    name: body.name,
    email: body.email === undefined ? undefined : trimOrNull(body.email),
    phone: body.phone === undefined ? undefined : trimOrNull(body.phone),
    notes: body.notes === undefined ? undefined : (body.notes ?? null),
  });
  if (!companion) routeHttpError(404, { error: 'Companion not found' });
  return { companion };
});

export const DELETE = route({ params: z.object({ id: z.coerce.number().int().positive() }) })(async ({
  user,
  params,
}) => {
  const companion = await deleteTripCompanion(user.id, params.id);
  if (!companion) routeHttpError(404, { error: 'Companion not found' });
  return { companion };
});
