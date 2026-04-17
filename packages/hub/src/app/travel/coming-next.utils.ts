import type { BookingDetails, FlightData, TransportDetails, TripBookingType, TripDocument } from '@my-hub/shared/types';
import type { TripBookingExtended } from './types';
import { TripBookingTypes, TripDocumentTypes } from '@my-hub/shared/constants';
import {
  isTransportBookingType,
  fmtDuration,
  hasValidLatLng,
  parseCoordinatePair,
  parseGeoUri,
  containsPlusCode,
} from '@my-hub/shared/utils';

const SegmentActions = {
  BoardingPass: 'boarding_pass',
  ViewBooking: 'view_booking',
  CopyRef: 'copy_ref',
  Navigate: 'navigate',
  ContactPhone: 'contact_phone',
  ContactEmail: 'contact_email',
} as const;

export type SegmentAction = {
  type: (typeof SegmentActions)[keyof typeof SegmentActions];
  label: string;
  value: string;
};

export type TimeBucket = 'past' | 'now' | 'imminent' | 'soon' | 'future';

export type Segment = {
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
};

// ---------------------------------------------------------------------------
// Endpoint labels per booking type
// ---------------------------------------------------------------------------

function endpointLabels(type: TripBookingType): { start: string; end: string } {
  switch (type) {
    case TripBookingTypes.Flight:
      return { start: 'Departure', end: 'Arrival' };
    case TripBookingTypes.Accommodation:
      return { start: 'Check-in', end: 'Check-out' };
    case TripBookingTypes.RentalCar:
      return { start: 'Pickup', end: 'Drop-off' };
    case TripBookingTypes.Train:
    case TripBookingTypes.Bus:
    case TripBookingTypes.Ferry:
      return { start: 'Departure', end: 'Arrival' };
    case TripBookingTypes.Taxi:
    case TripBookingTypes.Transfer:
      return { start: 'Pickup', end: 'Drop-off' };
    case TripBookingTypes.Car:
      return { start: 'Departure', end: 'Arrival' };
    case TripBookingTypes.Tour:
    case TripBookingTypes.Activity:
    case TripBookingTypes.Restaurant:
      return { start: 'Reservation', end: 'End' };
    case TripBookingTypes.Other:
    default:
      return { start: 'Start', end: 'End' };
  }
}

// ---------------------------------------------------------------------------
// Duration badge
// ---------------------------------------------------------------------------

function computeDuration(booking: TripBookingExtended, fd: FlightData | null): string | null {
  if (!booking.endAt) return null;

  const startMs = new Date(booking.startAt!).getTime();
  const endMs = new Date(booking.endAt).getTime();
  const diffMs = endMs - startMs;
  if (diffMs <= 0) return null;

  if (booking.bookingType === TripBookingTypes.Flight) {
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
    return flightMs > 0 ? fmtDuration(flightMs) : fmtDuration(diffMs);
  }

  if (booking.bookingType === TripBookingTypes.Accommodation) {
    // Night count = calendar day difference
    const startDay = new Date(booking.startAt!);
    const endDay = new Date(booking.endAt);
    startDay.setHours(0, 0, 0, 0);
    endDay.setHours(0, 0, 0, 0);
    const nights = Math.round((endDay.getTime() - startDay.getTime()) / 86_400_000);
    return nights === 1 ? '1 night' : `${nights} nights`;
  }

  const DAY = 24 * 60 * 60 * 1000;
  if (diffMs < DAY) return fmtDuration(diffMs);
  const days = Math.round(diffMs / DAY);
  return days === 1 ? '1 day' : `${days} days`;
}

// ---------------------------------------------------------------------------
// Labels / actions
// ---------------------------------------------------------------------------

function rawTextExcerpt(booking: TripBookingExtended, maxLen = 80): string {
  const d = booking.details as BookingDetails | null;
  const text = d?.rawText;
  if (!text) return '';
  return text.length > maxLen ? `${text.slice(0, maxLen).trimEnd()}…` : text;
}

function getTransportDetails(booking: TripBookingExtended): TransportDetails | null {
  const d = booking.details as { kind?: string } | null;
  if (d?.kind === 'transport') return booking.details as TransportDetails;
  return null;
}

function deriveLabels(booking: TripBookingExtended): { primary: string; secondary: string } {
  const fd = booking.flightData;
  const d = (booking.details ?? {}) as {
    originIata?: string;
    destinationIata?: string;
    flightNumber?: string;
    gate?: string;
    seat?: string;
  };

  switch (booking.bookingType) {
    case TripBookingTypes.Flight: {
      const origin = fd?.originIata ?? d.originIata;
      const dest = fd?.destinationIata ?? d.destinationIata;
      const primary = origin && dest ? `${origin} → ${dest}` : booking.title;
      const parts = [
        fd?.flightNumber ?? d.flightNumber,
        (fd?.departureGate ?? d.gate) && `Gate ${fd?.departureGate ?? d.gate}`,
        d.seat && `Seat ${d.seat}`,
      ].filter(Boolean);
      return { primary, secondary: parts.join(' · ') || booking.provider || '' };
    }
    case TripBookingTypes.Accommodation: {
      const secondary = [booking.provider, booking.location].filter(Boolean).join(' · ');
      return { primary: booking.title, secondary: secondary || rawTextExcerpt(booking) };
    }
    default: {
      if (isTransportBookingType(booking.bookingType)) {
        const td = getTransportDetails(booking);
        const reference = td?.serviceNumber ?? booking.confirmationNumber;
        const seat = td?.seat ? `Seat ${td.seat}` : null;
        const travelClass = td?.class ?? null;

        if (td) {
          const primary = `${td.origin.name} → ${td.destination.name}`;
          const parts = [booking.provider, reference, seat, travelClass].filter(Boolean);
          return { primary, secondary: parts.join(' · ') || booking.provider || '' };
        }

        const parts = [booking.provider, reference].filter(Boolean);
        return { primary: booking.title, secondary: parts.join(' · ') || rawTextExcerpt(booking) };
      }
      const secondary = [booking.provider, booking.location].filter(Boolean).join(' · ');
      return { primary: booking.title, secondary: secondary || rawTextExcerpt(booking) };
    }
  }
}

function buildGoogleMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function isDirectMapUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();

    return (
      host === 'maps.app.goo.gl' ||
      host === 'maps.google.com' ||
      host === 'google.com' ||
      host.endsWith('.google.com') ||
      host === 'goo.gl' ||
      host === 'maps.apple.com' ||
      host.endsWith('.waze.com') ||
      host === 'waze.com' ||
      host.endsWith('.openstreetmap.org') ||
      host === 'openstreetmap.org'
    );
  } catch {
    return false;
  }
}

function parseDirectionalLocation(location: string): { start: string; end: string } | null {
  const arrow = location.match(/^\s*(.+?)\s*(?:->|→|=>|⟶)\s*(.+?)\s*$/);
  if (arrow) {
    const start = arrow[1]?.trim();
    const end = arrow[2]?.trim();
    if (start && end) return { start, end };
  }

  const fromTo = location.match(/^\s*from\s+(.+?)\s+to\s+(.+?)\s*$/i);
  if (fromTo) {
    const start = fromTo[1]?.trim();
    const end = fromTo[2]?.trim();
    if (start && end) return { start, end };
  }

  return null;
}

function endpointLocationQuery(booking: TripBookingExtended, endpoint: 'start' | 'end'): string | null {
  const fd = booking.flightData;
  const details = (booking.details ?? {}) as {
    originIata?: string;
    destinationIata?: string;
  };

  if (booking.bookingType === TripBookingTypes.Flight) {
    const origin = fd?.originIata ?? details.originIata;
    const destination = fd?.destinationIata ?? details.destinationIata;
    const flightEndpoint = endpoint === 'start' ? origin : destination;
    if (flightEndpoint) return flightEndpoint;
  }

  if (isTransportBookingType(booking.bookingType)) {
    const td = getTransportDetails(booking);
    if (td) {
      const loc = endpoint === 'start' ? td.origin : td.destination;
      return loc.address ?? loc.name;
    }
  }

  const rawLocation = booking.location?.trim();
  if (!rawLocation) return null;

  const directional = parseDirectionalLocation(rawLocation);
  if (directional) {
    return endpoint === 'start' ? directional.start : directional.end;
  }

  return rawLocation;
}

function buildNavigateUrl(booking: TripBookingExtended, endpoint: 'start' | 'end'): string | null {
  const query = endpointLocationQuery(booking, endpoint);

  // Prefer exact coordinates when we don't have a better endpoint-specific query.
  if (!query && hasValidLatLng(booking.lat, booking.lng)) {
    return buildGoogleMapsSearchUrl(`${booking.lat},${booking.lng}`);
  }

  if (hasValidLatLng(booking.lat, booking.lng) && query === booking.location?.trim()) {
    return buildGoogleMapsSearchUrl(`${booking.lat},${booking.lng}`);
  }

  if (!query) return null;

  if (isDirectMapUrl(query)) {
    return query;
  }

  const geoCoords = parseGeoUri(query);
  if (geoCoords) {
    return buildGoogleMapsSearchUrl(`${geoCoords.lat},${geoCoords.lng}`);
  }

  const coordinatePair = parseCoordinatePair(query);
  if (coordinatePair) {
    return buildGoogleMapsSearchUrl(`${coordinatePair.lat},${coordinatePair.lng}`);
  }

  if (containsPlusCode(query)) {
    return buildGoogleMapsSearchUrl(query);
  }

  // Common fallbacks: place names, addresses, place_id:..., what3words, free text.
  return buildGoogleMapsSearchUrl(query);
}

function deriveActions(
  booking: TripBookingExtended,
  bookingDocs: TripDocument[],
  endpoint: 'start' | 'end',
): SegmentAction[] {
  const actions: SegmentAction[] = [];

  if (endpoint === 'start') {
    if (booking.referenceLink) {
      actions.push({ type: SegmentActions.ViewBooking, label: 'Open link', value: booking.referenceLink });
    }

    for (const doc of bookingDocs) {
      const url = doc.storagePath ? `/api/travel/documents/${doc.id}/download` : doc.sourceUrl;
      if (!url) continue;

      if (doc.type === TripDocumentTypes.BoardingPass) {
        actions.push({ type: SegmentActions.BoardingPass, label: 'Boarding pass', value: url });
      } else {
        actions.push({ type: SegmentActions.ViewBooking, label: doc.title, value: url });
      }
    }

    if (booking.confirmationNumber) {
      actions.push({ type: SegmentActions.CopyRef, label: 'Copy ref', value: booking.confirmationNumber });
    }

    if (booking.contactPhone) {
      actions.push({
        type: SegmentActions.ContactPhone,
        label: booking.contactPhone,
        value: `tel:${booking.contactPhone}`,
      });
    }

    if (booking.contactEmail) {
      actions.push({
        type: SegmentActions.ContactEmail,
        label: booking.contactEmail,
        value: `mailto:${booking.contactEmail}`,
      });
    }
  }

  const navigateUrl = buildNavigateUrl(booking, endpoint);
  if (navigateUrl) {
    actions.push({
      type: SegmentActions.Navigate,
      label: 'Navigate',
      value: navigateUrl,
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
    .filter(b => b.startAt != null)
    .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime());

  for (const booking of sorted) {
    const labels = endpointLabels(booking.bookingType);
    const primarySecondary = deriveLabels(booking);
    const startActions = deriveActions(booking, docsByBookingId.get(booking.id) ?? [], 'start');
    const endActions = deriveActions(booking, docsByBookingId.get(booking.id) ?? [], 'end');
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
      actions: startActions,
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
        actions: endActions,
        ...endBucket,
      });
    }
  }

  // Sort all segments by datetime so interleaved bookings render in chronological order
  segments.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

  return segments;
}

export { formatSegmentTime } from '@my-hub/shared/utils';
