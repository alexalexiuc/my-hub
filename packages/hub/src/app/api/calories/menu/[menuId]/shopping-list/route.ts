import { route, routeHttpError, created } from '@/lib/api/route';
import { getShoppingListItems, addShoppingListItems } from '@my-hub/shared/services';
import {
  AddShoppingItemsSchema,
  AddShoppingItemsResponseSchema,
  GetShoppingListResponseSchema,
  MenuParamsSchema,
} from '../../menu.schemas';

export const GET = route({ params: MenuParamsSchema, response: GetShoppingListResponseSchema })(async ({
  user,
  params,
}) => {
  const items = await getShoppingListItems(user.id, params.menuId);
  return { items };
});

export const POST = route({
  params: MenuParamsSchema,
  body: AddShoppingItemsSchema,
  response: AddShoppingItemsResponseSchema,
})(async ({ user, params, body }) => {
  const items = await addShoppingListItems(user.id, params.menuId, body.texts);
  if (!items) return routeHttpError(404, { error: 'Menu not found' });
  return created({ items });
});
