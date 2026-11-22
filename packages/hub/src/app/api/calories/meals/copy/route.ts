import { z } from 'zod';
import { route, created } from '@/lib/api/route';
import { copyMealsToDate } from '@my-hub/shared/services';
import { isoDateSchema } from '@/lib/schemas/common';

const MealCopySchema = z.object({
  fromDate: isoDateSchema,
  toDate: isoDateSchema,
  /** Refuse (400) when `toDate` already has meals — for "copy yesterday" on an empty day. */
  onlyIfEmpty: z.boolean().optional(),
});

/**
 * POST /api/calories/meals/copy — re-logs every meal of `fromDate` onto `toDate` in one
 * transaction, so a failure never leaves the day half copied. Returns the new meals (empty when
 * `fromDate` had nothing logged).
 */
export const POST = route({ body: MealCopySchema })(async ({ user, body }) => {
  const meals = await copyMealsToDate(user.id, body.fromDate, body.toDate, { onlyIfEmpty: body.onlyIfEmpty });
  return created({ meals });
});
