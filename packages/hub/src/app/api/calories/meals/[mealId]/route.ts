import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { deleteMeal, updateMeal } from '@my-hub/shared/services';
import { MealTypesValues } from '@my-hub/shared/constants';
import { nonEmptyPatch } from '@/lib/schemas/common';

/**
 * Every optional field is also nullable, and the distinction carries meaning: omitted leaves the
 * field as it is, explicit `null` clears it. Without the nullable half there was no way to spell
 * "remove this calorie count" — an emptied field simply stayed at its old value.
 */
const MealUpdateSchema = nonEmptyPatch(
  z.object({
    description: z.string().trim().min(1).optional(),
    mealType: z.enum(MealTypesValues).optional(),
    kcal: z.number().int().nonnegative().nullish(),
    protein: z.number().nonnegative().nullish(),
    carbs: z.number().nonnegative().nullish(),
    fat: z.number().nonnegative().nullish(),
    notes: z.string().nullish(),
  }),
);

const MealIdParamSchema = z.object({ mealId: z.coerce.string().trim().min(1, 'Invalid meal id') });

export const PATCH = route({ body: MealUpdateSchema, params: MealIdParamSchema })(async ({ user, params, body }) => {
  // The service owns the undefined-means-leave-alone rule from here on, so no filtering twice.
  const updated = await updateMeal(user.id, params.mealId, body);
  if (!updated) routeHttpError(404, { error: 'Not found' });

  return { meal: updated };
});

export const DELETE = route({ params: MealIdParamSchema })(async ({ user, params }) => {
  const deleted = await deleteMeal(user.id, params.mealId);
  if (!deleted) routeHttpError(404, { error: 'Not found' });
  return { deleted: true };
});
