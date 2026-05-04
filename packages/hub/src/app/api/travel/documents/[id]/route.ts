import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { deleteTripDocument } from '@my-hub/shared/services';

export const DELETE = route({ params: z.object({ id: z.coerce.number().int().positive() }) })(async ({
  user,
  params,
}) => {
  const document = await deleteTripDocument(user.id, params.id);
  if (!document) routeHttpError(404, { error: 'Document not found' });
  return { document };
});
