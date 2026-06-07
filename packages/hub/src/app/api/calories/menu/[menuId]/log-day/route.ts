import { route, routeHttpError } from '@/lib/api/route';
import { markDayAsLogged } from '@my-hub/shared/services';
import { LogDayBodySchema, LogDayResponseSchema, MenuParamsSchema } from '../../menu.schemas';

export const POST = route({ params: MenuParamsSchema, body: LogDayBodySchema, response: LogDayResponseSchema })(async ({
  user,
  params,
  body,
}) => {
  const marked = await markDayAsLogged(user.id, params.menuId, body.dayOfWeek, body.loggedDate, body.mealType);

  if (!marked) return routeHttpError(404, { error: 'Meal not found' });

  return { marked: true, dayOfWeek: body.dayOfWeek, mealType: body.mealType, loggedDate: body.loggedDate };
});
