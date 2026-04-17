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

  const { date: startAt, error: startAtError } = parseAndValidateDateForPatch(data.startAt, 'startAt');
  if (startAtError) return NextResponse.json({ error: startAtError }, { status: 400 });

  const { date: endAt, error: endAtError } = parseAndValidateDateForPatch(data.endAt, 'endAt');
  if (endAtError) return NextResponse.json({ error: endAtError }, { status: 400 });

  const flightDetails = data.flightDetails != null ? (data.flightDetails as Partial<FlightDetails>) : undefined;

  const booking = await updateTripBooking(user.id, bookingId, {
    title: data.title,
    bookingType: data.bookingType as Parameters<typeof updateTripBooking>[2]['bookingType'],
    provider: data.provider !== undefined ? data.provider.trim() || null : undefined,
    referenceLink: data.referenceLink !== undefined ? data.referenceLink.trim() || null : undefined,
    startAt,
    endAt,
    ...(flightDetails !== undefined && { details: flightDetails }),
    ...(data.contactName !== undefined && { contactName: data.contactName.trim() || null }),
    ...(data.contactEmail !== undefined && { contactEmail: data.contactEmail.trim() || null }),
    ...(data.contactPhone !== undefined && { contactPhone: data.contactPhone.trim() || null }),
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
