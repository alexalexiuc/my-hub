import { z } from 'zod';
import { route } from '@/lib/api/route';
import { addFavouriteMeal, getFavouriteMeals } from '@my-hub/shared/services';
import { MealTypesValues } from '@my-hub/shared/constants';

const FavouriteMealBodySchema = z.object({
  description: z.string().trim().min(1),
  mealType: z.enum(MealTypesValues),
  kcal: z.number().int().nonnegative().nullable(),
  protein: z.number().nonnegative().nullable(),
  carbs: z.number().nonnegative().nullable(),
  fat: z.number().nonnegative().nullable(),
});

/** The user's pinned meals, for the log-a-meal quick-pick row. */
export const GET = route(async ({ user }) => {
  const favourites = await getFavouriteMeals(user.id);
  return { favourites };
});

/** Pin a meal; pinning the same description again updates its macros. */
export const POST = route({ body: FavouriteMealBodySchema })(async ({ user, body }) => {
  const favourite = await addFavouriteMeal(user.id, body);
  return { favourite };
});
