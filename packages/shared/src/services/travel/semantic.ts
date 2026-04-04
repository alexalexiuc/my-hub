import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  flightData,
  tripBookings,
  tripChecklistItems,
  tripCompanions,
  tripDays,
  tripDocuments,
  tripPlaces,
} from '../../db/schema/travel';
import type {
  FlightData,
  Trip,
  TripBooking,
  TripChecklistItem,
  TripCompanion,
  TripDay,
  TripDocument,
  TripPlace,
} from '../../types/index';
import { coordsFromIata, timezoneFromIata } from '../../utils/airports';
import { getNextTrip, getTripByIdAccessible } from './trips';

export type TripBookingExtended = TripBooking & {
  flightData: FlightData | null;
  startTimezone: string | null;
  endTimezone: string | null;
};

export interface TripMapPoint {
  lat: number;
  lng: number;
  label: string;
  sub?: string;
}

export interface TripFlightArc {
  from: [number, number];
  to: [number, number];
}

export interface TripMapData {
  points: TripMapPoint[];
  arcs: TripFlightArc[];
}

export interface TripOverview {
  trip: Trip;
  bookings: TripBookingExtended[];
  places: TripPlace[];
  checklist: TripChecklistItem[];
  companions: TripCompanion[];
  documents: TripDocument[];
  dayNotes: TripDay[];
  mapData: TripMapData;
}

export async function getTripOverview(userId: string, tripId: number): Promise<TripOverview | null> {
  const trip = await getTripByIdAccessible(userId, tripId);
  if (!trip) return null;

  const [rawBookings, places, checklist, companions, documents, dayNotes] = await Promise.all([
    db
      .select()
      .from(tripBookings)
      .where(eq(tripBookings.tripId, tripId))
      .orderBy(asc(tripBookings.startAt), asc(tripBookings.id)),
    db
      .select()
      .from(tripPlaces)
      .where(eq(tripPlaces.tripId, tripId))
      .orderBy(asc(tripPlaces.visited), asc(tripPlaces.priority), asc(tripPlaces.id)),
    db
      .select()
      .from(tripChecklistItems)
      .where(eq(tripChecklistItems.tripId, tripId))
      .orderBy(asc(tripChecklistItems.done), asc(tripChecklistItems.id)),
    db.select().from(tripCompanions).where(eq(tripCompanions.tripId, tripId)).orderBy(asc(tripCompanions.id)),
    db.select().from(tripDocuments).where(eq(tripDocuments.tripId, tripId)).orderBy(asc(tripDocuments.id)),
    db.select().from(tripDays).where(eq(tripDays.tripId, tripId)).orderBy(asc(tripDays.date)),
  ]);

  // Attach flight_data rows to flight bookings that have a link
  const flightDataIds = rawBookings.map((b) => b.flightDataId).filter((id): id is number => id != null);
  const uniqueFlightDataIds = Array.from(new Set(flightDataIds));

  const flightDataMap = new Map<number, FlightData>();
  if (uniqueFlightDataIds.length > 0) {
    const rows = await db.select().from(flightData).where(inArray(flightData.id, uniqueFlightDataIds));
    for (const row of rows) flightDataMap.set(row.id, row);
  }

  const bookings: TripBookingExtended[] = rawBookings.map((b) => {
    const fd = b.flightDataId != null ? (flightDataMap.get(b.flightDataId) ?? null) : null;
    let startTimezone: string | null;
    let endTimezone: string | null;
    if (fd) {
      startTimezone = fd.originIata ? timezoneFromIata(fd.originIata) : null;
      endTimezone = fd.destinationIata ? timezoneFromIata(fd.destinationIata) : null;
    } else {
      startTimezone = b.timezone ?? null;
      endTimezone = b.timezone ?? null;
    }
    return { ...b, flightData: fd, startTimezone, endTimezone };
  });

  // Build map data server-side so the client never needs the airports JSON bundle
  const mapPoints: TripMapPoint[] = [];
  const mapArcs: TripFlightArc[] = [];

  for (const b of bookings) {
    const fd = b.flightData;
    if (fd?.originIata && fd?.destinationIata) {
      const origin = coordsFromIata(fd.originIata);
      const dest = coordsFromIata(fd.destinationIata);
      if (origin)
        mapPoints.push({ lat: origin.lat, lng: origin.lng, label: fd.originIata, sub: fd.airlineName ?? undefined });
      if (dest)
        mapPoints.push({ lat: dest.lat, lng: dest.lng, label: fd.destinationIata, sub: fd.airlineName ?? undefined });
      if (origin && dest) mapArcs.push({ from: [origin.lat, origin.lng], to: [dest.lat, dest.lng] });
    } else if (b.lat != null && b.lng != null) {
      mapPoints.push({ lat: b.lat, lng: b.lng, label: b.title, sub: b.provider ?? undefined });
    }
  }

  for (const p of places) {
    if (p.lat != null && p.lng != null) {
      mapPoints.push({ lat: p.lat, lng: p.lng, label: p.name, sub: p.location ?? undefined });
    }
  }

  return {
    trip,
    bookings,
    places,
    checklist,
    companions,
    documents,
    dayNotes,
    mapData: { points: mapPoints, arcs: mapArcs },
  };
}

export async function getTripBrief(userId: string, tripId?: number): Promise<TripOverview | null> {
  if (tripId) return getTripOverview(userId, tripId);

  const next = await getNextTrip(userId);
  if (!next) return null;

  return getTripOverview(userId, next.id);
}

export async function getTripTimeline(userId: string, tripId: number): Promise<TripBooking[]> {
  return db
    .select()
    .from(tripBookings)
    .where(and(eq(tripBookings.userId, userId), eq(tripBookings.tripId, tripId)))
    .orderBy(asc(tripBookings.startAt), asc(tripBookings.id));
}

export async function getUpcomingBookings(userId: string, hoursAhead = 48): Promise<TripBooking[]> {
  const now = new Date();
  const until = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  return db
    .select()
    .from(tripBookings)
    .where(
      and(
        eq(tripBookings.userId, userId),
        gte(tripBookings.startAt, now),
        lte(tripBookings.startAt, until),
        eq(tripBookings.bookingType, 'flight'),
      ),
    )
    .orderBy(asc(tripBookings.startAt), asc(tripBookings.id));
}

export function suggestChecklistTemplate(destination?: string): string[] {
  const common = [
    'Passport / ID valid for travel period',
    'Travel insurance details saved',
    'Primary payment card enabled for travel',
    'Mobile roaming / eSIM configured',
    'Accommodation check-in details verified',
    'Transport reservations saved offline',
  ];

  if (!destination) return common;

  return [`Weather check for ${destination}`, ...common];
}
