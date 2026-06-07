import { route } from '@/lib/api/route';
import { getWeeklyMenu, deleteWeeklyMenu, getLoggedDays, updateWeeklyMenuMeal } from '@my-hub/shared/services';
import { MealTypesValues } from '@my-hub/shared/constants';
import type { DayOfWeek } from '@my-hub/shared/constants';
import { z } from 'zod';

const ParamsSchema = z.object({ menuId: z.string() });

export const GET = route({ params: ParamsSchema })(async ({ user, params }) => {
  const menu = await getWeeklyMenu(user.id, params.menuId);
  if (!menu) return Response.json({ error: 'Not found' }, { status: 404 });
  const loggedDays = await getLoggedDays(params.menuId);
  return { menu, loggedDays };
});

export const DELETE = route({ params: ParamsSchema })(async ({ user, params }) => {
  const deleted = await deleteWeeklyMenu(user.id, params.menuId);
  if (!deleted) return Response.json({ error: 'Not found' }, { status: 404 });
  return { deleted: true };
});

const SwapMealBodySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  mealType: z.enum(MealTypesValues),
  description: z.string().min(1),
  kcal: z.number().int().positive().nullable().optional(),
  protein: z.number().positive().nullable().optional(),
  carbs: z.number().positive().nullable().optional(),
  fat: z.number().positive().nullable().optional(),
});

export const PATCH = route({ params: ParamsSchema, body: SwapMealBodySchema })(async ({ user, params, body }) => {
  const updated = await updateWeeklyMenuMeal(user.id, params.menuId, body.dayOfWeek as DayOfWeek, body.mealType, {
    description: body.description,
    kcal: body.kcal,
    protein: body.protein,
    carbs: body.carbs,
    fat: body.fat,
  });
  if (!updated) return Response.json({ error: 'Meal not found' }, { status: 404 });
  return { meal: updated };
});
