import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { deleteTrip, updateTrip } from '@my-hub/shared/services';
import { parseAndValidateDateForPatch } from '@/lib/api/date-validation';
import { omitUndefined, trimOrNull } from '@my-hub/shared/utils';
const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-F]{6}$/i, 'Must be a hex color (#RRGGBB)')
  .optional();

const TripUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  destination: z.string().nullable().optional(),
  color: hexColorSchema,
  startAt: z.string().nullable().optional(),
  endAt: z.string().nullable().optional(),
  cancelledAt: z.string().nullable().optional(),
  notes: z.string().optional(),
  coverImageUrl: z.string().optional(),
});

export const PATCH = route({ params: z.object({ id: z.coerce.number().int().positive() }), body: TripUpdateSchema })(
  async ({ user, params, body }) => {
    const tripId = params.id;

    const { date: startAt, error: startAtError } = parseAndValidateDateForPatch(body.startAt, 'startAt');
    if (startAtError) routeHttpError(400, { error: startAtError });

    const { date: endAt, error: endAtError } = parseAndValidateDateForPatch(body.endAt, 'endAt');
    if (endAtError) routeHttpError(400, { error: endAtError });

    const { date: cancelledAt, error: cancelledAtError } = parseAndValidateDateForPatch(
      body.cancelledAt,
      'cancelledAt',
    );
    if (cancelledAtError) routeHttpError(400, { error: cancelledAtError });

    const trip = await updateTrip(
      user.id,
      tripId,
      omitUndefined({
        name: body.name,
        destination: trimOrNull(body.destination),
        color: body.color,
        startAt,
        endAt,
        cancelledAt,
        notes: body.notes,
        coverImageUrl: body.coverImageUrl,
      }),
    );

    if (!trip) routeHttpError(404, { error: 'Trip not found' });
    return { trip };
  },
);

export const DELETE = route({ params: z.object({ id: z.coerce.number().int().positive() }) })(async ({
  user,
  params,
}) => {
  const tripId = params.id;
  if (!tripId) routeHttpError(400, { error: 'Invalid trip id' });
  const trip = await deleteTrip(user.id, tripId);
  if (!trip) routeHttpError(404, { error: 'Trip not found' });
  return { trip };
});
