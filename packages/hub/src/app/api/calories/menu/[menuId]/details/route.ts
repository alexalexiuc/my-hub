import { route, routeHttpError } from '@/lib/api/route';
import { updateWeeklyMenu } from '@my-hub/shared/services';
import { MenuParamsSchema, UpdateMenuDetailsSchema, UpdateMenuDetailsResponseSchema } from '../../menu.schemas';

/**
 * Patch a menu's own fields — title and prep notes — as opposed to `PATCH ../[menuId]`, which is
 * slot-addressed and swaps a meal. Follows the service's update semantics: an omitted field is
 * left alone, an explicit `null` clears it.
 */
export const PATCH = route({
  params: MenuParamsSchema,
  body: UpdateMenuDetailsSchema,
  response: UpdateMenuDetailsResponseSchema,
})(async ({ user, params, body }) => {
  const menu = await updateWeeklyMenu(user.id, params.menuId, { title: body.title, notes: body.notes });
  if (!menu) return routeHttpError(404, { error: 'Menu not found' });
  return { menu };
});
