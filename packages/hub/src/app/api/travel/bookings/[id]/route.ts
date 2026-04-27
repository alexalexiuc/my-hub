import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { deleteTripBooking, updateTripBooking } from '@my-hub/shared/services';
import type { FlightDetails } from '@my-hub/shared/types';
import { parseAndValidateDateForPatch } from '@/lib/api/date-validation';
import { omitUndefined, trimOrNull } from '@my-hub/shared/utils';
import { tripBookingTypeValues } from '@my-hub/shared/constants';

const BookingUpdateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  bookingType: z.enum(tripBookingTypeValues as [string, ...string[]]).optional(),
  provider: z.string().nullable().optional(),
  referenceLink: z.string().nullable().optional(),
  startAt: z.string().nullable().optional(),
  endAt: z.string().nullable().optional(),
  flightDetails: z.record(z.string(), z.unknown()).optional(),
  contactName: z.string().nullable().optional(),
  contactEmail: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
});

export const PATCH = route({ params: z.object({ id: z.coerce.number().int().positive() }), body: BookingUpdateSchema })(
  async ({ user, params, body }) => {
    const bookingId = params.id;

    const { date: startAt, error: startAtError } = parseAndValidateDateForPatch(body.startAt, 'startAt');
    if (startAtError) routeHttpError(400, { error: startAtError });

    const { date: endAt, error: endAtError } = parseAndValidateDateForPatch(body.endAt, 'endAt');
    if (endAtError) routeHttpError(400, { error: endAtError });

    const flightDetails = body.flightDetails != null ? (body.flightDetails as Partial<FlightDetails>) : undefined;

    const booking = await updateTripBooking(
      user.id,
      bookingId,
      omitUndefined({
        title: body.title,
        bookingType: body.bookingType as Parameters<typeof updateTripBooking>[2]['bookingType'],
        provider: trimOrNull(body.provider),
        referenceLink: trimOrNull(body.referenceLink),
        startAt,
        endAt,
        details: flightDetails,
        contactName: trimOrNull(body.contactName),
        contactEmail: trimOrNull(body.contactEmail),
        contactPhone: trimOrNull(body.contactPhone),
      }),
    );

    if (!booking) routeHttpError(404, { error: 'Booking not found' });
    return { booking };
  },
);

export const DELETE = route({ params: z.object({ id: z.coerce.number().int().positive() }) })(async ({
  user,
  params,
}) => {
  const bookingId = params.id;
  const booking = await deleteTripBooking(user.id, bookingId);
  if (!booking) routeHttpError(404, { error: 'Booking not found' });
  return { booking };
});
