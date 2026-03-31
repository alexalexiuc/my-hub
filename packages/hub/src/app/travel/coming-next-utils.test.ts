import { describe, expect, it } from 'vitest';
import { mapBookingsToSegments, formatSegmentTime } from './coming-next-utils';
import type { TripBookingExtended } from './types';
import type { TripDocument } from '@my-hub/shared/types';

const HOUR = 60 * 60 * 1000;

function makeBooking(overrides: Partial<TripBookingExtended> & { id: number }): TripBookingExtended {
  return {
    userId: 'user-1',
    tripId: 1,
    title: 'Test Booking',
    bookingType: 'other',
    provider: null,
    confirmationNumber: null,
    startAt: null,
    endAt: null,
    status: null,
    costAmount: null,
    costCurrency: 'EUR',
    location: null,
    notes: null,
    details: null,
    flightDataId: null,
    flightData: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeDocument(overrides: Partial<TripDocument> & { id: number; bookingId: number }): TripDocument {
  return {
    userId: 'user-1',
    tripId: 1,
    type: 'other',
    title: 'Document',
    notes: null,
    sourceUrl: null,
    originalName: null,
    mimeType: null,
    byteSize: null,
    storagePath: null,
    publicUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('mapBookingsToSegments', () => {
  const now = new Date('2026-03-31T10:00:00Z');

  it('returns empty array for empty bookings', () => {
    expect(mapBookingsToSegments([], [], now)).toEqual([]);
  });

  it('skips bookings without startAt', () => {
    const bookings = [makeBooking({ id: 1, startAt: null })];
    expect(mapBookingsToSegments(bookings, [], now)).toEqual([]);
  });

  it('sorts by startAt ascending', () => {
    const bookings = [
      makeBooking({ id: 2, startAt: new Date('2026-03-31T14:00:00Z'), title: 'Later' }),
      makeBooking({ id: 1, startAt: new Date('2026-03-31T12:00:00Z'), title: 'Earlier' }),
    ];
    const segments = mapBookingsToSegments(bookings, [], now);
    expect(segments[0]!.primaryLabel).toBe('Earlier');
    expect(segments[1]!.primaryLabel).toBe('Later');
  });

  it('detects active booking (now within start..end)', () => {
    const bookings = [
      makeBooking({
        id: 1,
        startAt: new Date('2026-03-31T09:00:00Z'),
        endAt: new Date('2026-03-31T11:00:00Z'),
      }),
    ];
    const segments = mapBookingsToSegments(bookings, [], now);
    expect(segments[0]!.isActive).toBe(true);
  });

  it('detects active booking with no endAt (within 2h window)', () => {
    const bookings = [makeBooking({ id: 1, startAt: new Date('2026-03-31T09:00:00Z') })];
    const segments = mapBookingsToSegments(bookings, [], now);
    expect(segments[0]!.isActive).toBe(true);
  });

  it('marks future booking as not active', () => {
    const bookings = [makeBooking({ id: 1, startAt: new Date('2026-03-31T15:00:00Z') })];
    const segments = mapBookingsToSegments(bookings, [], now);
    expect(segments[0]!.isActive).toBe(false);
  });

  it('derives flight labels from flightData', () => {
    const bookings = [
      makeBooking({
        id: 1,
        bookingType: 'flight',
        startAt: new Date('2026-03-31T12:00:00Z'),
        title: 'Flight to Berlin',
        flightData: {
          id: 1,
          flightNumber: 'BA982',
          flightDate: '2026-03-31',
          originIata: 'LHR',
          destinationIata: 'TXL',
          departureGate: 'B24',
          departureTerminal: null,
          arrivalTerminal: null,
          status: null,
          aircraftType: null,
          aircraftRegistration: null,
          airlineIata: null,
          airlineName: null,
          autoUpdateEnabled: true,
          rawResponse: null,
          finished: false,
        } as TripBookingExtended['flightData'],
        details: { seat: '14A' },
      }),
    ];
    const segments = mapBookingsToSegments(bookings, [], now);
    expect(segments[0]!.primaryLabel).toBe('LHR → TXL');
    expect(segments[0]!.secondaryLabel).toContain('BA982');
    expect(segments[0]!.secondaryLabel).toContain('Gate B24');
    expect(segments[0]!.secondaryLabel).toContain('Seat 14A');
  });

  it('derives actions from documents', () => {
    const bookings = [makeBooking({ id: 1, startAt: new Date('2026-03-31T12:00:00Z') })];
    const docs = [
      makeDocument({
        id: 10,
        bookingId: 1,
        type: 'boarding_pass',
        title: 'Boarding Pass',
        storagePath: '/path/to/file',
      }),
      makeDocument({
        id: 11,
        bookingId: 1,
        type: 'voucher',
        title: 'Hotel Voucher',
        sourceUrl: 'https://example.com/voucher',
      }),
    ];
    const segments = mapBookingsToSegments(bookings, docs, now);
    const actions = segments[0]!.actions;
    expect(actions).toHaveLength(2);
    expect(actions[0]!.type).toBe('boarding_pass');
    expect(actions[0]!.value).toBe('/api/travel/documents/10/download');
    expect(actions[1]!.type).toBe('view_booking');
    expect(actions[1]!.value).toBe('https://example.com/voucher');
  });

  it('derives copy_ref action from confirmationNumber', () => {
    const bookings = [
      makeBooking({
        id: 1,
        startAt: new Date('2026-03-31T12:00:00Z'),
        confirmationNumber: 'ABC123',
      }),
    ];
    const segments = mapBookingsToSegments(bookings, [], now);
    const copyAction = segments[0]!.actions.find((a) => a.type === 'copy_ref');
    expect(copyAction).toBeDefined();
    expect(copyAction!.value).toBe('ABC123');
  });

  it('derives navigate action from location', () => {
    const bookings = [
      makeBooking({
        id: 1,
        startAt: new Date('2026-03-31T12:00:00Z'),
        location: '123 Main St',
      }),
    ];
    const segments = mapBookingsToSegments(bookings, [], now);
    const navAction = segments[0]!.actions.find((a) => a.type === 'navigate');
    expect(navAction).toBeDefined();
    expect(navAction!.value).toContain('maps.google.com');
    expect(navAction!.value).toContain('123%20Main%20St');
  });

  it('shows empty actions for booking with no docs, no confirmation, no location', () => {
    const bookings = [makeBooking({ id: 1, bookingType: 'tour', startAt: new Date('2026-03-31T12:00:00Z') })];
    const segments = mapBookingsToSegments(bookings, [], now);
    expect(segments[0]!.actions).toEqual([]);
  });

  it('marks past booking isPast=true with timeBucket=past', () => {
    // Booking ended 3 hours before now (started 5h ago, ended 1h ago, now=10:00 UTC)
    const bookings = [
      makeBooking({
        id: 1,
        startAt: new Date('2026-03-31T05:00:00Z'),
        endAt: new Date('2026-03-31T09:00:00Z'),
      }),
    ];
    const segments = mapBookingsToSegments(bookings, [], now);
    expect(segments[0]!.isPast).toBe(true);
    expect(segments[0]!.timeBucket).toBe('past');
    expect(segments[0]!.isActive).toBe(false);
  });

  it('marks active booking timeBucket=now', () => {
    const bookings = [
      makeBooking({
        id: 1,
        startAt: new Date('2026-03-31T09:00:00Z'),
        endAt: new Date('2026-03-31T11:00:00Z'),
      }),
    ];
    const segments = mapBookingsToSegments(bookings, [], now);
    expect(segments[0]!.timeBucket).toBe('now');
    expect(segments[0]!.isPast).toBe(false);
  });

  it('marks imminent booking (< 1h away) timeBucket=imminent', () => {
    const bookings = [
      makeBooking({
        id: 1,
        startAt: new Date('2026-03-31T10:30:00Z'), // 30 min from now
      }),
    ];
    const segments = mapBookingsToSegments(bookings, [], now);
    expect(segments[0]!.timeBucket).toBe('imminent');
    expect(segments[0]!.isPast).toBe(false);
  });

  it('marks soon booking (< 24h away) timeBucket=soon', () => {
    const bookings = [
      makeBooking({
        id: 1,
        startAt: new Date('2026-03-31T20:00:00Z'), // 10h from now
      }),
    ];
    const segments = mapBookingsToSegments(bookings, [], now);
    expect(segments[0]!.timeBucket).toBe('soon');
  });

  it('marks distant future booking timeBucket=future', () => {
    const bookings = [
      makeBooking({
        id: 1,
        startAt: new Date('2026-04-05T10:00:00Z'), // 5 days from now
      }),
    ];
    const segments = mapBookingsToSegments(bookings, [], now);
    expect(segments[0]!.timeBucket).toBe('future');
    expect(segments[0]!.isPast).toBe(false);
  });

  it('correctly orders and buckets multiple bookings at different states', () => {
    const bookings = [
      makeBooking({ id: 1, title: 'Past Booking', startAt: new Date('2026-03-31T05:00:00Z'), endAt: new Date('2026-03-31T07:00:00Z') }),
      makeBooking({ id: 2, title: 'Active Booking', startAt: new Date('2026-03-31T09:00:00Z'), endAt: new Date('2026-03-31T11:00:00Z') }),
      makeBooking({ id: 3, title: 'Imminent Booking', startAt: new Date('2026-03-31T10:45:00Z') }),
      makeBooking({ id: 4, title: 'Soon Booking', startAt: new Date('2026-03-31T18:00:00Z') }),
      makeBooking({ id: 5, title: 'Future Booking', startAt: new Date('2026-04-10T10:00:00Z') }),
    ];
    const segments = mapBookingsToSegments(bookings, [], now);
    expect(segments).toHaveLength(5);
    expect(segments[0]!.timeBucket).toBe('past');
    expect(segments[1]!.timeBucket).toBe('now');
    expect(segments[2]!.timeBucket).toBe('imminent');
    expect(segments[3]!.timeBucket).toBe('soon');
    expect(segments[4]!.timeBucket).toBe('future');
    // Verify sort order
    expect(segments[0]!.primaryLabel).toBe('Past Booking');
    expect(segments[4]!.primaryLabel).toBe('Future Booking');
  });

  it('derives accommodation labels', () => {
    const bookings = [
      makeBooking({
        id: 1,
        bookingType: 'accommodation',
        startAt: new Date('2026-03-31T14:00:00Z'),
        title: 'Hotel Berlin',
        provider: 'Marriott',
        location: 'Friedrichstrasse 42',
      }),
    ];
    const segments = mapBookingsToSegments(bookings, [], now);
    expect(segments[0]!.primaryLabel).toBe('Hotel Berlin');
    expect(segments[0]!.secondaryLabel).toBe('Marriott · Friedrichstrasse 42');
  });

  it('derives train labels', () => {
    const bookings = [
      makeBooking({
        id: 1,
        bookingType: 'train',
        startAt: new Date('2026-03-31T14:00:00Z'),
        title: 'Berlin → Munich',
        provider: 'Deutsche Bahn',
        confirmationNumber: 'DB789',
      }),
    ];
    const segments = mapBookingsToSegments(bookings, [], now);
    expect(segments[0]!.primaryLabel).toBe('Berlin → Munich');
    expect(segments[0]!.secondaryLabel).toBe('Deutsche Bahn · DB789');
  });
});

describe('formatSegmentTime', () => {
  const now = new Date('2026-03-31T10:00:00Z');

  it('formats time within 24h as relative', () => {
    const target = new Date(now.getTime() + 2 * HOUR + 40 * 60 * 1000).toISOString();
    const result = formatSegmentTime(target, now);
    expect(result.text).toBe('In 2 h 40 min');
    expect(result.isSoon).toBe(true);
  });

  it('formats time under 1h as minutes only', () => {
    const target = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
    const result = formatSegmentTime(target, now);
    expect(result.text).toBe('In 30 min');
    expect(result.isSoon).toBe(true);
  });

  it('marks isSoon=false when more than 3h away', () => {
    const target = new Date(now.getTime() + 5 * HOUR).toISOString();
    const result = formatSegmentTime(target, now);
    expect(result.isSoon).toBe(false);
  });

  it('formats tomorrow with "Tomorrow" prefix', () => {
    const tomorrow = new Date('2026-04-01T14:00:00Z');
    const result = formatSegmentTime(tomorrow.toISOString(), now);
    expect(result.text).toContain('Tomorrow');
    expect(result.text).toContain('14:00');
    expect(result.isSoon).toBe(false);
  });

  it('formats next-day time as "Tomorrow" even when less than 24h away', () => {
    // now = 23:30, target = 00:15 next calendar day (~45 min away)
    const lateNow = new Date('2026-03-31T23:30:00Z');
    const earlyTomorrow = new Date('2026-04-01T00:15:00Z');
    const result = formatSegmentTime(earlyTomorrow.toISOString(), lateNow);
    expect(result.text).toContain('Tomorrow');
    expect(result.text).toContain('00:15');
    expect(result.isSoon).toBe(false);
  });

  it('formats dates beyond tomorrow with date + time', () => {
    const future = new Date('2026-04-05T09:30:00Z');
    const result = formatSegmentTime(future.toISOString(), now);
    expect(result.text).toContain('5');
    expect(result.text).toContain('Apr');
    expect(result.text).toContain('09:30');
    expect(result.isSoon).toBe(false);
  });

  it('formats past times as date + time', () => {
    const past = new Date('2026-03-31T08:30:00Z');
    const result = formatSegmentTime(past.toISOString(), now);
    // Exact time is omitted because getHours()/getMinutes() use local timezone
    // and would differ across environments; date and month are stable.
    expect(result.text).toContain('31');
    expect(result.text).toContain('Mar');
    expect(result.isSoon).toBe(false);
  });
});
