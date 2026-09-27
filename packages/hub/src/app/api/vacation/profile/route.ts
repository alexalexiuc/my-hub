import { route } from '@/lib/api/route';
import { applyVacationSetup } from '@my-hub/shared/services';
import { VacationProfileBodySchema } from '../vacation.schemas';

/**
 * PUT /api/vacation/profile
 * Creates or updates the vacation profile (country, employer, opening balance). Validation
 * failures come back as a 400 from the service's `VacationValidationError`.
 */
export const PUT = route({ body: VacationProfileBodySchema })(async ({ user, body }) => {
  const summary = await applyVacationSetup(user.id, { profile: body });
  return { profile: summary.profile };
});
