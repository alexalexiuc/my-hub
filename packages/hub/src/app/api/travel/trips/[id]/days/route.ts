import { z } from 'zod';
import { route } from '@/lib/api/route';
import { getTripDays, upsertTripDay } from '@my-hub/shared/services';
const DayCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date is required (YYYY-MM-DD)'),
  title: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  placeIds: z.array(z.number().int()).nullable().optional(),
});

export const GET = route({ params: z.object({ id: z.coerce.number().int().positive() }) })(async ({ user, params }) => {
  const days = await getTripDays(user.id, params.id);
  return { days };
});

export const POST = route({ params: z.object({ id: z.coerce.number().int().positive() }), body: DayCreateSchema })(
  async ({ user, params, body }) => {
    const tripId = params.id;
    const day = await upsertTripDay(user.id, tripId, body.date, {
      title: body.title ?? null,
      notes: body.notes ?? null,
      placeIds: body.placeIds,
    });
    return { day };
  },
);
