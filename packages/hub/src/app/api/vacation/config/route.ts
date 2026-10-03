import { route } from '@/lib/api/route';
import { getVacationConfig } from '@my-hub/shared/services';
import { currentDateString } from '@my-hub/shared/utils';

/**
 * GET /api/vacation/config
 * Profile, rule sets, tax regimes, leave periods, salary and holiday coverage, plus setup warnings.
 * `profile` is null until one has been saved.
 */
export const GET = route(async ({ user }) => getVacationConfig(user.id, currentDateString()));
