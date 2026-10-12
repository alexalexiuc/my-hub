import { z } from 'zod';
import { route } from '@/lib/api/route';
import { getRecentMealSuggestions } from '@my-hub/shared/services';

const RecentMealsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).optional(),
});

/**
 * The user's recently logged meals, deduplicated by description, for the log-a-meal modal's
 * one-tap suggestions. A static segment, so it takes precedence over the sibling `[mealId]`
 * route and can never be read as a meal id.
 */
export const GET = route({ query: RecentMealsQuerySchema })(async ({ user, query }) => {
  const meals = await getRecentMealSuggestions(user.id, query.limit);
  return { meals };
});
