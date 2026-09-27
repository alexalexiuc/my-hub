import { z } from 'zod';
import { route } from '@/lib/api/route';
import { applyLeaveChanges } from '@my-hub/shared/services';

/** DELETE /api/vacation/leave/:id — removes one leave period. */
export const DELETE = route({ params: z.object({ id: z.coerce.number().int().positive() }) })(
  async ({ user, params }) => applyLeaveChanges(user.id, { remove: [params.id] }),
);
