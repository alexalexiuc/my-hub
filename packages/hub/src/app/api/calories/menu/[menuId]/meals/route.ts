import { route, routeHttpError } from '@/lib/api/route';
import { addMealToMenu, deleteWeeklyMenuMeal } from '@my-hub/shared/services';
import {
  DeleteMenuMealSchema,
  MenuMealResponseSchema,
  MenuMealWriteSchema,
  MenuParamsSchema,
} from '../../menu.schemas';

export const POST = route({ params: MenuParamsSchema, body: MenuMealWriteSchema, response: MenuMealResponseSchema })(
  async ({ user, params, body }) => {
    const meal = await addMealToMenu(user.id, params.menuId, {
      dayOfWeek: body.dayOfWeek,
      mealType: body.mealType,
      description: body.description,
      ingredients: body.ingredients,
      kcal: body.kcal,
      protein: body.protein,
      carbs: body.carbs,
      fat: body.fat,
    });
    if (!meal) return routeHttpError(409, { error: 'Menu not found or meal slot already exists' });
    return { meal };
  },
);

export const DELETE = route({ params: MenuParamsSchema, body: DeleteMenuMealSchema })(async ({
  user,
  params,
  body,
}) => {
  const removed = await deleteWeeklyMenuMeal(user.id, params.menuId, body.dayOfWeek, body.mealType);
  if (!removed) return routeHttpError(404, { error: 'Meal not found' });
  return { deleted: true };
});
