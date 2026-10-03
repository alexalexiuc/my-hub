import { route } from '@/lib/api/route';
import { applyLeaveChanges, getVacationLeaveEstimates } from '@my-hub/shared/services';
import { VacationLeaveBodySchema, VacationLeaveQuerySchema } from '../vacation.schemas';

/**
 * GET /api/vacation/leave?includeDraftRules=true
 * Every recorded leave period, oldest first, each priced as one leave (net pay, delta vs working,
 * balance cost, rest). `estimate` is null when no salary backs the rate of its start month.
 */
export const GET = route({ query: VacationLeaveQuerySchema })(async ({ user, query }) =>
  getVacationLeaveEstimates(user.id, { ...query, allowDemo: true }),
);

/**
 * POST /api/vacation/leave
 * Records a leave period, or overwrites one when `id` is given. Overlapping leave is rejected
 * with a 400.
 */
export const POST = route({ body: VacationLeaveBodySchema })(async ({ user, body }) =>
  applyLeaveChanges(user.id, { upsert: [body] }),
);
