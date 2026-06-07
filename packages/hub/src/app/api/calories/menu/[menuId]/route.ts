import { route, routeHttpError } from '@/lib/api/route';
import { getWeeklyMenu, deleteWeeklyMenu, getLoggedDays, updateWeeklyMenuMeal } from '@my-hub/shared/services';
import { GetMenuResponseSchema, MenuMealResponseSchema, MenuMealWriteSchema, MenuParamsSchema } from '../menu.schemas';

export const GET = route({ params: MenuParamsSchema, response: GetMenuResponseSchema })(async ({ user, params }) => {
  const [menu, loggedDays] = await Promise.all([
    getWeeklyMenu(user.id, params.menuId),
    getLoggedDays(user.id, params.menuId),
  ]);
  if (!menu) return routeHttpError(404, { error: 'Meal not found' });

  return { menu, loggedDays };
});

export const DELETE = route({ params: MenuParamsSchema })(async ({ user, params }) => {
  const deleted = await deleteWeeklyMenu(user.id, params.menuId);
  if (!deleted) return routeHttpError(404, { error: 'Meal not found' });
  return { deleted: true };
});

export const PATCH = route({ params: MenuParamsSchema, body: MenuMealWriteSchema, response: MenuMealResponseSchema })(
  async ({ user, params, body }) => {
    const updated = await updateWeeklyMenuMeal(user.id, params.menuId, body.dayOfWeek, body.mealType, {
      description: body.description,
      kcal: body.kcal,
      protein: body.protein,
      carbs: body.carbs,
      fat: body.fat,
    });
    if (!updated) return routeHttpError(404, { error: 'Meal not found' });
    return { meal: updated };
  },
);
