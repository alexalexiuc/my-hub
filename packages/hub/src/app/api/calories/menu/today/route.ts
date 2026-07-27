import { route } from '@/lib/api/route';
import { getPlannedMealsForDate } from '@my-hub/shared/services';
import { TodayPlanQuerySchema, TodayPlanResponseSchema } from '../menu.schemas';

/**
 * The planned meals for one day, so the Today page and the dashboard can show what is coming
 * without the user opening the Weekly Menu tab. A static segment, so it takes precedence over
 * the sibling `[menuId]` route and can never be read as a menu id.
 *
 * The week lookup, the day filter and the logged-marker join all live in the service: "what am
 * I eating and have I had it yet" is a domain question, and the MCP tools need the same answer.
 */
export const GET = route({ query: TodayPlanQuerySchema, response: TodayPlanResponseSchema })(async ({
  user,
  query,
}) => {
  const meals = await getPlannedMealsForDate(user.id, query.date);
  return { menuId: meals[0]?.menuId ?? null, meals };
});
