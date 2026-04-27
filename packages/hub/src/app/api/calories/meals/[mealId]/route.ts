import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { deleteMeal, updateMeal } from '@my-hub/shared/services';
import { MealTypesValues } from '@my-hub/shared/constants';
import type { MealType } from '@my-hub/shared/constants';

const MealUpdateSchema = z.object({
  description: z.string().trim().min(1).optional(),
  mealType: z.enum(MealTypesValues).optional(),
  kcal: z.number().optional(),
  protein: z.number().optional(),
  carbs: z.number().optional(),
  fat: z.number().optional(),
  notes: z.string().optional(),
});

const MealIdParamSchema = z.object({ mealId: z.coerce.string().trim().min(1, 'Invalid meal id') });

export const PATCH = route({ body: MealUpdateSchema, params: MealIdParamSchema })(async ({ user, params, body }) => {
  const update = {
    ...body,
    mealType: body.mealType as MealType | undefined,
    ...(body.kcal != null ? { kcal: Math.round(body.kcal) } : {}),
  };

  const updated = await updateMeal(user.id, params.mealId, update);
  if (!updated) routeHttpError(404, { error: 'Not found' });

  return { meal: updated };
});

export const DELETE = route({ params: MealIdParamSchema })(async ({ user, params }) => {
  const deleted = await deleteMeal(user.id, params.mealId);
  if (!deleted) routeHttpError(404, { error: 'Not found' });
  return { deleted: true };
});
