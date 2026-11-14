import { describe, expect, it } from 'vitest';
import { bookingDateRange, deriveTripStatus, inheritTripDates } from './travel';

const d = (iso: string) => new Date(iso);

describe('bookingDateRange', () => {
  it('spans earliest start to latest end, falling back to start when a booking has no end', () => {
    expect(
      bookingDateRange([
        { startAt: d('2026-11-24T14:30:00Z'), endAt: d('2026-11-27T10:30:00Z') },
        { startAt: d('2026-11-24T08:00:00Z'), endAt: null },
        { startAt: d('2026-11-28T09:00:00Z'), endAt: null },
        { startAt: null, endAt: null },
      ]),
    ).toEqual({ fromAt: d('2026-11-24T08:00:00Z'), toAt: d('2026-11-28T09:00:00Z') });
  });

  it('is empty when no booking is dated', () => {
    expect(bookingDateRange([{ startAt: null, endAt: null }])).toEqual({ fromAt: null, toAt: null });
    expect(bookingDateRange([])).toEqual({ fromAt: null, toAt: null });
  });
});

describe('inheritTripDates', () => {
  const range = { fromAt: d('2026-11-24T14:30:00Z'), toAt: d('2026-11-27T10:30:00Z') };

  it('fills missing trip dates from the booking range', () => {
    expect(inheritTripDates({ id: 1, startAt: null, endAt: null }, range)).toEqual({
      id: 1,
      startAt: range.fromAt,
      endAt: range.toAt,
    });
  });

  it('keeps dates set on the trip', () => {
    const own = d('2026-11-23T00:00:00Z');
    expect(inheritTripDates({ startAt: own, endAt: null }, range)).toEqual({ startAt: own, endAt: range.toAt });
  });

  it('leaves an undated trip without bookings undated', () => {
    expect(inheritTripDates({ startAt: null, endAt: null }, undefined)).toEqual({ startAt: null, endAt: null });
  });

  it('makes an undated trip active while its bookings are under way', () => {
    const trip = inheritTripDates({ startAt: null, endAt: null }, range);
    expect(deriveTripStatus(null, trip.startAt, trip.endAt, d('2026-11-25T12:00:00Z'))).toBe('active');
  });
});
