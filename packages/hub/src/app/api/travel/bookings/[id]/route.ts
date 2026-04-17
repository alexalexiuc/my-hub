import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { deleteTripBooking, updateTripBooking } from '@my-hub/shared/services';
import type { FlightDetails } from '@my-hub/shared/types';
import { parseAndValidateDateForPatch } from '@/lib/api/date-validation';
import { BookingUpdateSchema } from '@my-hub/shared/schemas';

export const PATCH = withAuth<{ id: string }>(async ({ req, user, params }) => {
  const { id } = await params;
  const bookingId = Number(id);
  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = BookingUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data } = parsed;

  const { date: startAt, error: startAtError } = parseAndValidateDateForPatch(data.start_at, 'start_at');
  if (startAtError) return NextResponse.json({ error: startAtError }, { status: 400 });

  const { date: endAt, error: endAtError } = parseAndValidateDateForPatch(data.end_at, 'end_at');
  if (endAtError) return NextResponse.json({ error: endAtError }, { status: 400 });

  const flightDetails = data.flight_details != null ? (data.flight_details as Partial<FlightDetails>) : undefined;

  const booking = await updateTripBooking(user.id, bookingId, {
    title: data.title,
    bookingType: data.booking_type as Parameters<typeof updateTripBooking>[2]['bookingType'],
    provider: data.provider !== undefined ? data.provider.trim() || null : undefined,
    referenceLink: data.reference_link !== undefined ? data.reference_link.trim() || null : undefined,
    startAt,
    endAt,
    ...(flightDetails !== undefined && { details: flightDetails }),
    ...(data.contact_name !== undefined && { contactName: data.contact_name.trim() || null }),
    ...(data.contact_email !== undefined && { contactEmail: data.contact_email.trim() || null }),
    ...(data.contact_phone !== undefined && { contactPhone: data.contact_phone.trim() || null }),
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
