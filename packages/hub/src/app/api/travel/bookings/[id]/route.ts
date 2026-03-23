import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { deleteTripBooking, updateTripBooking } from '@my-hub/shared/services';
import type { TripBookingType } from '@my-hub/shared/types';
import { parseAndValidateDateForPatch } from '@/lib/api/date-validation';

const bookingTypes: TripBookingType[] = [
  'flight',
  'accommodation',
  'rental_car',
  'train',
  'bus',
  'ferry',
  'taxi',
  'restaurant',
  'tour',
  'activity',
  'ticket',
  'other',
];

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

  const booking = await updateTripBooking(user.id, bookingId, {
    title: typeof body.title === 'string' ? body.title.trim() : undefined,
    bookingType:
      typeof body.booking_type === 'string' && bookingTypes.includes(body.booking_type as TripBookingType)
        ? (body.booking_type as TripBookingType)
        : undefined,
    provider: typeof body.provider === 'string' ? body.provider.trim() || null : undefined,
    startAt: startAt,
    endAt: endAt,
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
