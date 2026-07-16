import { route, routeHttpError } from '@/lib/api/route';
import { setShoppingListItemChecked, deleteShoppingListItem } from '@my-hub/shared/services';
import { ShoppingItemParamsSchema, ShoppingItemResponseSchema, UpdateShoppingItemSchema } from '../../../menu.schemas';

export const PATCH = route({
  params: ShoppingItemParamsSchema,
  body: UpdateShoppingItemSchema,
  response: ShoppingItemResponseSchema,
})(async ({ user, params, body }) => {
  const item = await setShoppingListItemChecked(user.id, params.itemId, body.checked);
  if (!item) return routeHttpError(404, { error: 'Shopping list item not found' });
  return { item };
});

export const DELETE = route({ params: ShoppingItemParamsSchema })(async ({ user, params }) => {
  const removed = await deleteShoppingListItem(user.id, params.itemId);
  if (!removed) return routeHttpError(404, { error: 'Shopping list item not found' });
  return { deleted: true };
});
