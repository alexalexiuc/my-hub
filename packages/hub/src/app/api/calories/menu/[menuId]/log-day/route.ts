import { route, routeHttpError } from '@/lib/api/route';
import { logMenuMeal, unlogMenuMeal } from '@my-hub/shared/services';
import { DeleteMenuMealSchema, LogDayBodySchema, LogDayResponseSchema, MenuParamsSchema } from '../../menu.schemas';

export const POST = route({ params: MenuParamsSchema, body: LogDayBodySchema, response: LogDayResponseSchema })(async ({
  user,
  params,
  body,
}) => {
  // Journals the meal and marks the slot logged in one transaction — a partial
  // failure can never leave a calorie entry without its logged marker.
  const marked = await logMenuMeal(user.id, params.menuId, body.dayOfWeek, body.mealType, body.loggedDate, {
    description: body.description,
    kcal: body.kcal,
    protein: body.protein,
    carbs: body.carbs,
    fat: body.fat,
  });

  if (!marked) return routeHttpError(404, { error: 'Menu not found' });

  return { marked: true, dayOfWeek: body.dayOfWeek, mealType: body.mealType, loggedDate: body.loggedDate };
});

/**
 * Undo a log. Identified by slot, like the other slot-addressed routes — the marker's own date is
 * what the service uses to find the journal entry, so the caller doesn't need to supply it.
 */
export const DELETE = route({ params: MenuParamsSchema, body: DeleteMenuMealSchema })(async ({
  user,
  params,
  body,
}) => {
  const unlogged = await unlogMenuMeal(user.id, params.menuId, body.dayOfWeek, body.mealType);
  if (!unlogged) return routeHttpError(404, { error: 'Logged meal not found' });
  return { unlogged: true };
});
