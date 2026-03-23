import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { parseAndValidateDate } from '@/lib/api/date-validation';
import { addTripBooking } from '@my-hub/shared/services';
import type { TripBookingType } from '@my-hub/shared/types';

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

export const POST = withAuth(async ({ req, user }) => {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const tripId = Number(body.trip_id);
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const bookingType =
    typeof body.booking_type === 'string' && bookingTypes.includes(body.booking_type as TripBookingType)
      ? (body.booking_type as TripBookingType)
      : 'other';

  if (!Number.isInteger(tripId) || tripId <= 0) {
    return NextResponse.json({ error: 'trip_id is required' }, { status: 400 });
  }

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const { date: startAt, error: startAtError } = parseAndValidateDate(body.start_at, 'start_at');
  if (startAtError) {
    return NextResponse.json({ error: startAtError }, { status: 400 });
  }

  const { date: endAt, error: endAtError } = parseAndValidateDate(body.end_at, 'end_at');
  if (endAtError) {
    return NextResponse.json({ error: endAtError }, { status: 400 });
  }
  const booking = await addTripBooking(user.id, tripId, {
    bookingType,
    title,
    provider: typeof body.provider === 'string' ? body.provider : null,
    confirmationNumber: typeof body.confirmation_number === 'string' ? body.confirmation_number : null,
    startAt,
    endAt,
    status: typeof body.status === 'string' ? body.status : 'scheduled',
    costAmount: typeof body.cost_amount === 'number' ? body.cost_amount : null,
    costCurrency: typeof body.cost_currency === 'string' ? body.cost_currency : 'EUR',
    location: typeof body.location === 'string' ? body.location : null,
    notes: typeof body.notes === 'string' ? body.notes : null,
    details: null,
  });

  return NextResponse.json({ booking }, { status: 201 });
});
