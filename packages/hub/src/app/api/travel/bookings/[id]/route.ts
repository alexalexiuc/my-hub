import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { deleteTripBooking, updateTripBooking } from '@my-hub/shared/services';
import type { FlightDetails, TripBookingType } from '@my-hub/shared/types';
import { parseAndValidateDateForPatch } from '@/lib/api/date-validation';
import { tripBookingTypeValues } from '@my-hub/shared/constants';

export const PATCH = withAuth<{ id: string }>(async ({ req, user, params }) => {
  const { id } = await params;
  const bookingId = Number(id);
  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { date: startAt, error: startAtError } = parseAndValidateDateForPatch(body.start_at, 'start_at');
  if (startAtError) {
    return NextResponse.json({ error: startAtError }, { status: 400 });
  }

  const { date: endAt, error: endAtError } = parseAndValidateDateForPatch(body.end_at, 'end_at');
  if (endAtError) {
    return NextResponse.json({ error: endAtError }, { status: 400 });
  }

  const flightDetails =
    body.flight_details != null && typeof body.flight_details === 'object' && !Array.isArray(body.flight_details)
      ? (body.flight_details as Partial<FlightDetails>)
      : undefined;

  const booking = await updateTripBooking(user.id, bookingId, {
    title: typeof body.title === 'string' ? body.title.trim() : undefined,
    bookingType:
      typeof body.booking_type === 'string' && tripBookingTypeValues.includes(body.booking_type as TripBookingType)
        ? (body.booking_type as TripBookingType)
        : undefined,
    provider: typeof body.provider === 'string' ? body.provider.trim() || null : undefined,
    startAt: startAt,
    endAt: endAt,
    ...(flightDetails !== undefined && { details: flightDetails }),
  });

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  return NextResponse.json({ booking });
});

export const DELETE = withAuth<{ id: string }>(async ({ user, params }) => {
  const { id } = await params;
  const bookingId = Number(id);
  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 });
  }

  const booking = await deleteTripBooking(user.id, bookingId);
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  return NextResponse.json({ booking });
});
