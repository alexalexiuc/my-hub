import { route } from '@/lib/api/route';
import { applyLeaveChanges } from '@my-hub/shared/services';
import { VacationLeaveBodySchema } from '../vacation.schemas';

/**
 * POST /api/vacation/leave
 * Records a leave period, or overwrites one when `id` is given. Overlapping leave is rejected
 * with a 400.
 */
export const POST = route({ body: VacationLeaveBodySchema })(async ({ user, body }) =>
  applyLeaveChanges(user.id, { upsert: [body] }),
);
