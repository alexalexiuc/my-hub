import { z } from 'zod';
import { route } from '@/lib/api/route';
import { markDayAsLogged } from '@my-hub/shared/services';
import { MealTypesValues } from '@my-hub/shared/constants';
import type { DayOfWeek, MealType } from '@my-hub/shared/constants';

const ParamsSchema = z.object({ menuId: z.string() });

const BodySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  loggedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealType: z.enum(MealTypesValues),
});

export const POST = route({ params: ParamsSchema, body: BodySchema })(async ({ user, params, body }) => {
  const marked = await markDayAsLogged(
    user.id,
    params.menuId,
    body.dayOfWeek as DayOfWeek,
    body.loggedDate,
    body.mealType as MealType,
  );

  if (!marked) return Response.json({ error: 'Not found' }, { status: 404 });

  return { marked: true, dayOfWeek: body.dayOfWeek, mealType: body.mealType, loggedDate: body.loggedDate };
});
