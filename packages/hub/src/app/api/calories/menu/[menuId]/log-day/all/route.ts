import { route, routeHttpError } from '@/lib/api/route';
import { logMenuDay, unlogMenuDay } from '@my-hub/shared/services';
import {
  LogWholeDaySchema,
  MenuParamsSchema,
  UnlogWholeDaySchema,
  WholeDayResponseSchema,
} from '../../../menu.schemas';

/**
 * Log or un-log a whole day in one transaction, rather than the client firing one request per
 * meal. A fan-out of N requests leaves a half-logged day when any of them fails — the same
 * desync the per-slot transaction guards against, one level up — and costs N round trips and N
 * re-renders for a single tap.
 */
export const POST = route({ params: MenuParamsSchema, body: LogWholeDaySchema, response: WholeDayResponseSchema })(
  async ({ user, params, body }) => {
    const affected = await logMenuDay(user.id, params.menuId, body.dayOfWeek, body.loggedDate);
    if (affected === null) return routeHttpError(404, { error: 'Menu not found' });
    return { affected };
  },
);

export const DELETE = route({ params: MenuParamsSchema, body: UnlogWholeDaySchema, response: WholeDayResponseSchema })(
  async ({ user, params, body }) => {
    const affected = await unlogMenuDay(user.id, params.menuId, body.dayOfWeek);
    if (affected === null) return routeHttpError(404, { error: 'Menu not found' });
    return { affected };
  },
);
