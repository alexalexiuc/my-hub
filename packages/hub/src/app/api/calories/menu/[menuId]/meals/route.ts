import { route, routeHttpError } from '@/lib/api/route';
import { addMealToMenu } from '@my-hub/shared/services';
import { MenuMealResponseSchema, MenuMealWriteSchema, MenuParamsSchema } from '../../menu.schemas';

export const POST = route({ params: MenuParamsSchema, body: MenuMealWriteSchema, response: MenuMealResponseSchema })(
  async ({ user, params, body }) => {
    const meal = await addMealToMenu(user.id, params.menuId, {
      dayOfWeek: body.dayOfWeek,
      mealType: body.mealType,
      description: body.description,
      kcal: body.kcal,
      protein: body.protein,
      carbs: body.carbs,
      fat: body.fat,
    });
    if (!meal) return routeHttpError(409, { error: 'Menu not found or meal slot already exists' });
    return { meal };
  },
);
