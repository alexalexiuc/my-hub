import { z } from 'zod';
import { route, routeHttpError, created } from '@/lib/api/route';
import { createTrip, getAccessibleTrips, getTripBookingRangesByTripIds } from '@my-hub/shared/services';
import { parseAndValidateDate } from '@/lib/api/date-validation';

const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-F]{6}$/i, 'Must be a hex color (#RRGGBB)')
  .optional();

const TripCreateSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  destination: z.string().nullable().optional(),
  color: hexColorSchema,
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  notes: z.string().optional(),
  coverImageUrl: z.string().optional(),
});

export const GET = route(async ({ user }) => {
  const accessibleTrips = await getAccessibleTrips(user.id);
  const ranges = await getTripBookingRangesByTripIds(accessibleTrips.map(item => item.trip.id));

  return {
    trips: accessibleTrips.map(item => ({
      ...item.trip,
      ownerUserId: item.ownerUserId,
      ownerName: item.ownerName,
      ownerEmail: item.ownerEmail,
      accessRole: item.accessRole,
      canEdit: item.accessRole === 'owner',
      permission: item.permission,
    })),
    bookingRanges: ranges,
  };
});

export const POST = route({ body: TripCreateSchema })(async ({ user, body }) => {
  const { date: startAt, error: startAtError } = parseAndValidateDate(body.startAt, 'startAt');
  if (startAtError) routeHttpError(400, { error: startAtError });

  const { date: endAt, error: endAtError } = parseAndValidateDate(body.endAt, 'endAt');
  if (endAtError) routeHttpError(400, { error: endAtError });

  const trip = await createTrip(user.id, {
    name: body.name,
    color: body.color,
    destination: body.destination?.trim() || null,
    startAt,
    endAt,
    notes: body.notes ?? null,
    coverImageUrl: null,
  });

  return created({ trip });
});
