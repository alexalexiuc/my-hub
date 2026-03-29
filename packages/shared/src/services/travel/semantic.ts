import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  flightData,
  tripBookings,
  tripChecklistItems,
  tripCompanions,
  tripDocuments,
  tripPlaces,
} from '../../db/schema/travel';
import type {
  FlightData,
  Trip,
  TripBooking,
  TripChecklistItem,
  TripCompanion,
  TripDocument,
  TripPlace,
} from '../../types/index';
import { getNextTrip, getTripByIdAccessible } from './trips';

export type TripBookingWithFlight = TripBooking & { flightData: FlightData | null };

export interface TripOverview {
  trip: Trip;
  bookings: TripBookingWithFlight[];
  places: TripPlace[];
  checklist: TripChecklistItem[];
  companions: TripCompanion[];
  documents: TripDocument[];
}

export async function getTripOverview(userId: string, tripId: number): Promise<TripOverview | null> {
  const trip = await getTripByIdAccessible(userId, tripId);
  if (!trip) return null;

  const [rawBookings, places, checklist, companions, documents] = await Promise.all([
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
  ]);

  // Attach flight_data rows to flight bookings that have a link
  const flightDataIds = rawBookings.map((b) => b.flightDataId).filter((id): id is number => id != null);

  const flightDataMap = new Map<number, FlightData>();
  if (flightDataIds.length > 0) {
    const rows = await db.select().from(flightData).where(inArray(flightData.id, flightDataIds));
    for (const row of rows) flightDataMap.set(row.id, row);
  }

  const bookings: TripBookingWithFlight[] = rawBookings.map((b) => ({
    ...b,
    flightData: b.flightDataId != null ? (flightDataMap.get(b.flightDataId) ?? null) : null,
  }));

  return {
    trip,
    bookings,
    places,
    checklist,
    companions,
    documents,
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
