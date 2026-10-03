import { route } from '@/lib/api/route';
import { applyVacationSetup, listVacationSalaries } from '@my-hub/shared/services';
import { VacationSalaryBodySchema } from '../vacation.schemas';

/** GET /api/vacation/salaries — every salary month, oldest first. */
export const GET = route(async ({ user }) => listVacationSalaries(user.id));

/** PUT /api/vacation/salaries — creates or overwrites the salary for one month. */
export const PUT = route({ body: VacationSalaryBodySchema })(async ({ user, body }) => {
  const summary = await applyVacationSetup(user.id, { salaries: { upsert: [body] } });
  return summary.salaries;
});
