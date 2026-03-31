import type { FlightDetails, TripBookingType, TripDocument } from '@my-hub/shared/types';
import type { TripBookingExtended } from './types';

export interface SegmentAction {
  type: 'boarding_pass' | 'view_booking' | 'copy_ref' | 'navigate';
  label: string;
  value: string;
}

export type TimeBucket = 'past' | 'now' | 'imminent' | 'soon' | 'future';

export interface Segment {
  id: number;
  bookingType: TripBookingType;
  datetime: string;
  isActive: boolean;
  isPast: boolean;
  timeBucket: TimeBucket;
  primaryLabel: string;
  secondaryLabel: string;
  actions: SegmentAction[];
}

function deriveLabels(booking: TripBookingExtended): { primary: string; secondary: string } {
  const fd = booking.flightData;
  const d = (booking.details ?? {}) as FlightDetails;

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

  return bookings
    .filter((b) => b.startAt != null)
    .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime())
    .map((booking) => {
      const startMs = new Date(booking.startAt!).getTime();
      const endMs = booking.endAt ? new Date(booking.endAt).getTime() : startMs + TWO_HOURS;
      const isActive = nowMs >= startMs && nowMs <= endMs;
      const isPast = endMs < nowMs;
      const diffMs = startMs - nowMs;

      let timeBucket: TimeBucket;
      if (isPast) timeBucket = 'past';
      else if (isActive) timeBucket = 'now';
      else if (diffMs <= ONE_HOUR) timeBucket = 'imminent';
      else if (diffMs <= TWENTY_FOUR_HOURS) timeBucket = 'soon';
      else timeBucket = 'future';

      const labels = deriveLabels(booking);
      const actions = deriveActions(booking, docsByBookingId.get(booking.id) ?? []);

      return {
        id: booking.id,
        bookingType: booking.bookingType,
        datetime: new Date(booking.startAt!).toISOString(),
        isActive,
        isPast,
        timeBucket,
        primaryLabel: labels.primary,
        secondaryLabel: labels.secondary,
        actions,
      };
    });
}

export function formatSegmentTime(datetime: string, now: Date = new Date()): { text: string; isSoon: boolean } {
  const target = new Date(datetime);
  const diffMs = target.getTime() - now.getTime();
  const THREE_HOURS = 3 * 60 * 60 * 1000;
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  const isSoon = diffMs > 0 && diffMs <= THREE_HOURS;

  const hours = target.getHours().toString().padStart(2, '0');
  const minutes = target.getMinutes().toString().padStart(2, '0');

  if (diffMs < 0) {
    // In the past — show date + time so it's clear when it occurred
    const month = target.toLocaleString('en', { month: 'short' });
    return { text: `${target.getDate()} ${month} · ${hours}:${minutes}`, isSoon: false };
  }

  // Check if the target falls on tomorrow's calendar day before applying relative format,
  // so that e.g. 23:50 → 00:15 shows "Tomorrow · 00:15" instead of "In 25 min".
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTargetTomorrow =
    target.getFullYear() === tomorrow.getFullYear() &&
    target.getMonth() === tomorrow.getMonth() &&
    target.getDate() === tomorrow.getDate();

  if (isTargetTomorrow) {
    return { text: `Tomorrow · ${hours}:${minutes}`, isSoon: false };
  }

  if (diffMs <= TWENTY_FOUR_HOURS) {
    const totalMinutes = Math.round(diffMs / 60000);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0) return { text: `In ${m} min`, isSoon };
    return { text: `In ${h} h ${m} min`, isSoon };
  }

  // Beyond 24h and not tomorrow — show day + time
  const month = target.toLocaleString('en', { month: 'short' });
  return { text: `${target.getDate()} ${month} · ${hours}:${minutes}`, isSoon: false };
}
