import { route, routeHttpError } from '@/lib/api/route';
import { logMenuMeal } from '@my-hub/shared/services';
import { LogDayBodySchema, LogDayResponseSchema, MenuParamsSchema } from '../../menu.schemas';

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
