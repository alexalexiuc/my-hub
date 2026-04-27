import { z } from 'zod';
import { route, routeHttpError, created } from '@/lib/api/route';
import { parseAndValidateDate } from '@/lib/api/date-validation';
import { addTripBooking } from '@my-hub/shared/services';
import type { FlightDetails } from '@my-hub/shared/types';
import { TripBookingTypes, tripBookingTypeValues } from '@my-hub/shared/constants';

const BookingCreateSchema = z.object({
  tripId: z.number().int().positive(),
  title: z.string().trim().min(1, 'title is required'),
  bookingType: z.enum(tripBookingTypeValues as [string, ...string[]]).optional(),
  provider: z.string().optional(),
  confirmationNumber: z.string().optional(),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  status: z.string().optional(),
  costAmount: z.number().optional(),
  costCurrency: z.string().optional(),
  location: z.string().optional(),
  referenceLink: z.string().optional(),
  notes: z.string().optional(),
  flightDetails: z.record(z.string(), z.unknown()).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
});

export const POST = route({ body: BookingCreateSchema })(async ({ user, body }) => {
  const { date: startAt, error: startAtError } = parseAndValidateDate(body.startAt, 'startAt');
  if (startAtError) routeHttpError(400, { error: startAtError });

  const { date: endAt, error: endAtError } = parseAndValidateDate(body.endAt, 'endAt');
  if (endAtError) routeHttpError(400, { error: endAtError });

  const bookingType = (body.bookingType ??
    TripBookingTypes.Other) as (typeof TripBookingTypes)[keyof typeof TripBookingTypes];

  const flightDetails =
    bookingType === TripBookingTypes.Flight && body.flightDetails != null
      ? (body.flightDetails as Partial<FlightDetails>)
      : null;

  const booking = await addTripBooking(user.id, body.tripId, {
    bookingType,
    title: body.title,
    provider: body.provider ?? null,
    confirmationNumber: body.confirmationNumber ?? null,
    startAt,
    endAt,
    status: body.status ?? 'scheduled',
    costAmount: body.costAmount ?? null,
    costCurrency: body.costCurrency ?? 'EUR',
    location: body.location ?? null,
    referenceLink: body.referenceLink?.trim() || null,
    notes: body.notes ?? null,
    details: flightDetails,
    lat: body.lat ?? null,
    lng: body.lng ?? null,
    contactName: body.contactName?.trim() || null,
    contactEmail: body.contactEmail?.trim() || null,
    contactPhone: body.contactPhone?.trim() || null,
  });

  return created({ booking });
});
