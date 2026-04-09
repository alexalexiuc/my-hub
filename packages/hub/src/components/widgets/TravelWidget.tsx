'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface BookingRange {
  tripId: number;
  fromAt: string | null;
  toAt: string | null;
}

interface TravelFocus {
  tripId: number;
  name: string;
  destination: string | null;
  color: string;
  status: 'ongoing' | 'upcoming';
  fromAt: string | null;
  toAt: string | null;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateRange(fromAt: string | null, toAt: string | null): string {
  const from = parseDate(fromAt);
  const to = parseDate(toAt);

  if (!from && !to) return 'Dates not set';
  if (from && !to) return from.toLocaleDateString();
  if (!from && to) return to.toLocaleDateString();

  const fromText = from!.toLocaleDateString();
  const toText = to!.toLocaleDateString();
  return fromText === toText ? fromText : `${fromText} -> ${toText}`;
}

function pickTravelFocus(
  trips: Array<{
    id: number;
    name: string;
    destination: string | null;
    color?: string | null;
    startAt?: string | null;
    endAt?: string | null;
  }>,
  bookingRanges: BookingRange[],
): TravelFocus | null {
  const now = new Date();
  const rangeByTripId = new Map<number, BookingRange>(bookingRanges.map((range) => [range.tripId, range]));

  const candidates = trips
    .map((trip) => {
      const range = rangeByTripId.get(trip.id);
      const from = parseDate(range?.fromAt ?? trip.startAt ?? null);
      const to = parseDate(range?.toAt ?? trip.endAt ?? null);

      if (!from) return null;

      if (to && from <= now && now <= to) {
        return {
          tripId: trip.id,
          name: trip.name,
          destination: trip.destination,
          color: trip.color ?? '#3B82F6',
          status: 'ongoing' as const,
          fromAt: range?.fromAt ?? trip.startAt ?? null,
          toAt: range?.toAt ?? trip.endAt ?? null,
          sortKey: to.getTime(),
          priority: 0,
        };
      }

      if (from >= now) {
        return {
          tripId: trip.id,
          name: trip.name,
          destination: trip.destination,
          color: trip.color ?? '#3B82F6',
          status: 'upcoming' as const,
          fromAt: range?.fromAt ?? trip.startAt ?? null,
          toAt: range?.toAt ?? trip.endAt ?? null,
          sortKey: from.getTime(),
          priority: 1,
        };
      }

      return null;
    })
    .filter((trip): trip is NonNullable<typeof trip> => Boolean(trip))
    .sort((a, b) => (a.priority !== b.priority ? a.priority - b.priority : a.sortKey - b.sortKey));

  if (candidates.length === 0) return null;

  const first = candidates[0];
  if (!first) return null;

  return {
    tripId: first.tripId,
    name: first.name,
    destination: first.destination,
    color: first.color,
    status: first.status,
    fromAt: first.fromAt,
    toAt: first.toAt,
  };
}

export function TravelWidget() {
  const [travelFocus, setTravelFocus] = useState<TravelFocus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/travel/trips')
      .then((res) =>
        res.ok
          ? (res.json() as Promise<{
              trips: Array<{
                id: number;
                name: string;
                destination: string | null;
                color?: string | null;
                startAt?: string | null;
                endAt?: string | null;
              }>;
              booking_ranges?: BookingRange[];
            }>)
          : null,
      )
      .then((data) => {
        if (data) {
          setTravelFocus(pickTravelFocus(data.trips ?? [], data.booking_ranges ?? []));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">Travel</h2>
        <div
          className="animate-pulse rounded-xl border border-zinc-800 bg-zinc-900 p-4"
          style={{ borderLeftWidth: '4px' }}
        >
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
            <div className="h-3.5 w-32 bg-zinc-700 rounded" />
          </div>
          <div className="mt-2 h-4 w-48 bg-zinc-700 rounded" />
          <div className="mt-1.5 h-3 w-40 bg-zinc-700 rounded" />
        </div>
      </section>
    );
  }

  if (!travelFocus) return null;

  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">Travel</h2>
      <Link
        href="/travel"
        className="block rounded-xl border border-zinc-800 bg-zinc-900 p-4 shadow-sm hover:bg-zinc-800 hover:border-zinc-700 transition"
        style={{ borderLeftColor: travelFocus.color, borderLeftWidth: '4px' }}
      >
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: travelFocus.color }} />
          <span className="text-sm font-semibold text-zinc-100">
            {travelFocus.status === 'ongoing' ? 'Ongoing Trip' : 'Upcoming Trip'}
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-200">{travelFocus.name}</p>
        <p className="text-xs text-zinc-400">
          {travelFocus.destination ?? 'Destination not set'} · {formatDateRange(travelFocus.fromAt, travelFocus.toAt)}
        </p>
      </Link>
    </section>
  );
}
