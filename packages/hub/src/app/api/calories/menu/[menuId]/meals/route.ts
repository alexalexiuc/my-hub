import { route } from '@/lib/api/route';
import { addMealToMenu } from '@my-hub/shared/services';
import { MealTypesValues } from '@my-hub/shared/constants';
import type { DayOfWeek } from '@my-hub/shared/constants';
import { z } from 'zod';

const ParamsSchema = z.object({ menuId: z.string() });

const AddMealBodySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  mealType: z.enum(MealTypesValues),
  description: z.string().min(1),
  kcal: z.number().int().positive().nullable().optional(),
  protein: z.number().positive().nullable().optional(),
  carbs: z.number().positive().nullable().optional(),
  fat: z.number().positive().nullable().optional(),
});

export const POST = route({ params: ParamsSchema, body: AddMealBodySchema })(async ({ user, params, body }) => {
  const meal = await addMealToMenu(user.id, params.menuId, {
    dayOfWeek: body.dayOfWeek as DayOfWeek,
    mealType: body.mealType,
    description: body.description,
    kcal: body.kcal,
    protein: body.protein,
    carbs: body.carbs,
    fat: body.fat,
  });
  if (!meal) return Response.json({ error: 'Menu not found or meal slot already exists' }, { status: 409 });
  return { meal };
});
