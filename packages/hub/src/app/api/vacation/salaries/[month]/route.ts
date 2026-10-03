import { z } from 'zod';
import { route } from '@/lib/api/route';
import { applyVacationSetup } from '@my-hub/shared/services';
import { isoMonthSchema } from '@/lib/schemas/common';

/** DELETE /api/vacation/salaries/:month — removes the salary row for one YYYY-MM month. */
export const DELETE = route({ params: z.object({ month: isoMonthSchema }) })(async ({ user, params }) => {
  const summary = await applyVacationSetup(user.id, { salaries: { remove: [params.month] } });
  return summary.salaries;
});
