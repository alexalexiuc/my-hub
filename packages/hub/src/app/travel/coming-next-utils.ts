import type { FlightData, TripBookingType, TripDocument } from '@my-hub/shared/types';
import type { TripBookingExtended } from './types';

export interface SegmentAction {
  type: 'boarding_pass' | 'view_booking' | 'copy_ref' | 'navigate';
  label: string;
  value: string;
}

export type TimeBucket = 'past' | 'now' | 'imminent' | 'soon' | 'future';

export interface Segment {
  segmentId: string; // e.g. '42-start' or '42-end'
  bookingId: number;
  bookingType: TripBookingType;
  endpointLabel: string; // 'Departure', 'Check-in', 'Pickup', etc.
  datetime: string; // ISO string for this endpoint
  timezone: string | null; // IANA string, null → show UTC badge
  isActive: boolean;
  isPast: boolean;
  isEndSegment: boolean;
  timeBucket: TimeBucket;
  primaryLabel: string;
  secondaryLabel: string;
  durationBadge: string | null; // only on end segment
  actions: SegmentAction[];
}

// ---------------------------------------------------------------------------
// Endpoint labels per booking type
// ---------------------------------------------------------------------------

function endpointLabels(type: TripBookingType): { start: string; end: string } {
  switch (type) {
    case 'flight':
      return { start: 'Departure', end: 'Arrival' };
    case 'accommodation':
      return { start: 'Check-in', end: 'Check-out' };
    case 'rental_car':
      return { start: 'Pickup', end: 'Drop-off' };
    case 'train':
    case 'bus':
    case 'ferry':
      return { start: 'Departure', end: 'Arrival' };
    case 'taxi':
      return { start: 'Pickup', end: 'Drop-off' };
    case 'tour':
    case 'activity':
    case 'ticket':
      return { start: 'Start', end: 'End' };
    case 'restaurant':
      return { start: 'Reservation', end: 'End' };
    case 'other':
    default:
      return { start: 'Start', end: 'End' };
  }
}

// ---------------------------------------------------------------------------
// Duration badge
// ---------------------------------------------------------------------------

function fmtHm(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function computeDuration(booking: TripBookingExtended, fd: FlightData | null): string | null {
  if (!booking.endAt) return null;

  const startMs = new Date(booking.startAt!).getTime();
  const endMs = new Date(booking.endAt).getTime();
  const diffMs = endMs - startMs;
  if (diffMs <= 0) return null;

  if (booking.bookingType === 'flight') {
    // Prefer actual flight times, then scheduled, then booking times
    const depMs = fd?.actualDepartureAt
      ? new Date(fd.actualDepartureAt).getTime()
      : fd?.scheduledDepartureAt
        ? new Date(fd.scheduledDepartureAt).getTime()
        : startMs;
    const arrMs = fd?.actualArrivalAt
      ? new Date(fd.actualArrivalAt).getTime()
      : fd?.scheduledArrivalAt
        ? new Date(fd.scheduledArrivalAt).getTime()
        : endMs;
    const flightMs = arrMs - depMs;
    return flightMs > 0 ? fmtHm(flightMs) : fmtHm(diffMs);
  }

  if (booking.bookingType === 'accommodation') {
    // Night count = calendar day difference
    const startDay = new Date(booking.startAt!);
    const endDay = new Date(booking.endAt);
    startDay.setHours(0, 0, 0, 0);
    endDay.setHours(0, 0, 0, 0);
    const nights = Math.round((endDay.getTime() - startDay.getTime()) / 86_400_000);
    return nights === 1 ? '1 night' : `${nights} nights`;
  }

  const DAY = 24 * 60 * 60 * 1000;
  if (diffMs < DAY) return fmtHm(diffMs);
  const days = Math.round(diffMs / DAY);
  return days === 1 ? '1 day' : `${days} days`;
}

// ---------------------------------------------------------------------------
// Labels / actions
// ---------------------------------------------------------------------------

function deriveLabels(booking: TripBookingExtended): { primary: string; secondary: string } {
  const fd = booking.flightData;
  const d = (booking.details ?? {}) as {
    origin_iata?: string;
    destination_iata?: string;
    flight_number?: string;
    gate?: string;
    seat?: string;
  };

  switch (booking.bookingType) {
    case 'flight': {
      const origin = fd?.originIata ?? d.origin_iata;
      const dest = fd?.destinationIata ?? d.destination_iata;
      const primary = origin && dest ? `${origin} → ${dest}` : booking.title;
      const parts = [
        fd?.flightNumber ?? d.flight_number,
        (fd?.departureGate ?? d.gate) && `Gate ${fd?.departureGate ?? d.gate}`,
        d.seat && `Seat ${d.seat}`,
      ].filter(Boolean);
      return { primary, secondary: parts.join(' · ') || booking.provider || '' };
    }
    case 'accommodation':
      return {
        primary: booking.title,
        secondary: [booking.provider, booking.location].filter(Boolean).join(' · '),
      };
    case 'taxi':
      return {
        primary: booking.title,
        secondary: booking.location || booking.provider || '',
      };
    case 'train':
    case 'bus':
    case 'ferry':
      return {
        primary: booking.title,
        secondary: [booking.provider, booking.confirmationNumber].filter(Boolean).join(' · '),
      };
    default:
      return {
        primary: booking.title,
        secondary: [booking.provider, booking.location].filter(Boolean).join(' · '),
      };
  }
}

function deriveActions(booking: TripBookingExtended, bookingDocs: TripDocument[]): SegmentAction[] {
  const actions: SegmentAction[] = [];

  for (const doc of bookingDocs) {
    const url = doc.storagePath ? `/api/travel/documents/${doc.id}/download` : doc.sourceUrl;
    if (!url) continue;

    if (doc.type === 'boarding_pass') {
      actions.push({ type: 'boarding_pass', label: 'Boarding pass', value: url });
    } else {
      actions.push({ type: 'view_booking', label: doc.title, value: url });
    }
  }

  if (booking.confirmationNumber) {
    actions.push({ type: 'copy_ref', label: 'Copy ref', value: booking.confirmationNumber });
  }

  if (booking.location) {
    actions.push({
      type: 'navigate',
      label: 'Navigate',
      value: `https://maps.google.com/?q=${encodeURIComponent(booking.location)}`,
    });
  }

  return actions;
}

// ---------------------------------------------------------------------------
// mapBookingsToSegments — emits 1 or 2 segments per booking
// ---------------------------------------------------------------------------

export function mapBookingsToSegments(
  bookings: TripBookingExtended[],
  documents: TripDocument[],
  now: Date = new Date(),
): Segment[] {
  const docsByBookingId = new Map<number, TripDocument[]>();
  for (const doc of documents) {
    if (!doc.bookingId) continue;
    const list = docsByBookingId.get(doc.bookingId) ?? [];
    list.push(doc);
    docsByBookingId.set(doc.bookingId, list);
  }

  const nowMs = now.getTime();
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  const ONE_HOUR = 60 * 60 * 1000;
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  function timeBucketFor(
    startMs: number,
    endMs: number,
  ): { timeBucket: TimeBucket; isActive: boolean; isPast: boolean } {
    const isActive = nowMs >= startMs && nowMs <= endMs;
    const isPast = endMs < nowMs;
    const diffMs = startMs - nowMs;
    let timeBucket: TimeBucket;
    if (isPast) timeBucket = 'past';
    else if (isActive) timeBucket = 'now';
    else if (diffMs <= ONE_HOUR) timeBucket = 'imminent';
    else if (diffMs <= TWENTY_FOUR_HOURS) timeBucket = 'soon';
    else timeBucket = 'future';
    return { timeBucket, isActive, isPast };
  }

  const segments: Segment[] = [];

  const sorted = bookings
    .filter((b) => b.startAt != null)
    .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime());

  for (const booking of sorted) {
    const labels = endpointLabels(booking.bookingType);
    const primarySecondary = deriveLabels(booking);
    const actions = deriveActions(booking, docsByBookingId.get(booking.id) ?? []);
    const fd = booking.flightData;

    const startMs = new Date(booking.startAt!).getTime();
    const endMs = booking.endAt ? new Date(booking.endAt).getTime() : startMs + TWO_HOURS;
    const duration = computeDuration(booking, fd);

    // Start segment
    const startBucket = timeBucketFor(startMs, booking.endAt ? endMs : startMs + TWO_HOURS);
    segments.push({
      segmentId: `${booking.id}-start`,
      bookingId: booking.id,
      bookingType: booking.bookingType,
      endpointLabel: labels.start,
      datetime: new Date(booking.startAt!).toISOString(),
      timezone: booking.startTimezone,
      isEndSegment: false,
      durationBadge: null,
      primaryLabel: primarySecondary.primary,
      secondaryLabel: primarySecondary.secondary,
      actions,
      ...startBucket,
    });

    // End segment — only when endAt is explicitly set
    if (booking.endAt) {
      const endBucket = timeBucketFor(endMs, endMs);
      segments.push({
        segmentId: `${booking.id}-end`,
        bookingId: booking.id,
        bookingType: booking.bookingType,
        endpointLabel: labels.end,
        datetime: new Date(booking.endAt).toISOString(),
        timezone: booking.endTimezone,
        isEndSegment: true,
        durationBadge: duration,
        primaryLabel: primarySecondary.primary,
        secondaryLabel: primarySecondary.secondary,
        actions: [], // actions shown only on start chip
        ...endBucket,
      });
    }
  }

  // Sort all segments by datetime so interleaved bookings render in chronological order
  segments.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

  return segments;
}

// ---------------------------------------------------------------------------
// formatSegmentTime — timezone-aware
// ---------------------------------------------------------------------------

export function formatSegmentTime(
  datetime: string,
  timezone: string | null,
  now: Date = new Date(),
): { text: string; isSoon: boolean } {
  const target = new Date(datetime);
  const diffMs = target.getTime() - now.getTime();
  const THREE_HOURS = 3 * 60 * 60 * 1000;
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  const isSoon = diffMs > 0 && diffMs <= THREE_HOURS;

  // Format HH:MM in the endpoint's local timezone; fall back to UTC when unset
  const tz = timezone ?? 'UTC';
  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: tz,
  });
  const dateFormatter = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: tz,
  });

  const timeStr = timeFormatter.format(target);

  if (diffMs < 0) {
    return { text: `${dateFormatter.format(target)} · ${timeStr}`, isSoon: false };
  }

  // Check if target is tomorrow in tz (not the runtime's local timezone)
  const isoInTz = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
  const nowDateStr = isoInTz(now);
  const [y, m, day] = nowDateStr.split('-').map(Number) as [number, number, number];
  const tomorrowDateStr = isoInTz(new Date(Date.UTC(y, m - 1, day + 1)));

  if (isoInTz(target) === tomorrowDateStr) {
    return { text: `Tomorrow · ${timeStr}`, isSoon: false };
  }

  if (diffMs <= TWENTY_FOUR_HOURS) {
    const totalMinutes = Math.round(diffMs / 60000);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0) return { text: `In ${m} min`, isSoon };
    return { text: `In ${h} h ${m} min`, isSoon };
  }

  return { text: `${dateFormatter.format(target)} · ${timeStr}`, isSoon: false };
}
