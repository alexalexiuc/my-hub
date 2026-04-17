import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { parseAndValidateDate } from '@/lib/api/date-validation';
import { addTripBooking } from '@my-hub/shared/services';
import type { FlightDetails } from '@my-hub/shared/types';
import { TripBookingTypes } from '@my-hub/shared/constants';
import { BookingCreateSchema } from '@my-hub/shared/schemas';

export const POST = withAuth(async ({ req, user }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = BookingCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data } = parsed;

  const { date: startAt, error: startAtError } = parseAndValidateDate(data.startAt, 'startAt');
  if (startAtError) return NextResponse.json({ error: startAtError }, { status: 400 });

  const { date: endAt, error: endAtError } = parseAndValidateDate(data.endAt, 'endAt');
  if (endAtError) return NextResponse.json({ error: endAtError }, { status: 400 });

  const bookingType = data.bookingType ?? TripBookingTypes.Other;

  const flightDetails =
    bookingType === TripBookingTypes.Flight && data.flightDetails != null
      ? (data.flightDetails as Partial<FlightDetails>)
      : null;

  const booking = await addTripBooking(user.id, data.tripId, {
    bookingType,
    title: data.title,
    provider: data.provider ?? null,
    confirmationNumber: data.confirmationNumber ?? null,
    startAt,
    endAt,
    status: data.status ?? 'scheduled',
    costAmount: data.costAmount ?? null,
    costCurrency: data.costCurrency ?? 'EUR',
    location: data.location ?? null,
    referenceLink: data.referenceLink?.trim() || null,
    notes: data.notes ?? null,
    details: flightDetails,
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    contactName: data.contactName?.trim() || null,
    contactEmail: data.contactEmail?.trim() || null,
    contactPhone: data.contactPhone?.trim() || null,
  });

  return NextResponse.json({ booking }, { status: 201 });
});
