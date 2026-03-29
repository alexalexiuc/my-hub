import { and, eq, lte } from 'drizzle-orm';
import { db } from '../../db/client';
import { flightData, tripBookings } from '../../db/schema/travel';
import type { FlightData } from '../../types/index';

// ---------------------------------------------------------------------------
// Schedule helpers
// ---------------------------------------------------------------------------

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000);
}

/**
 * Compute when we should next poll the API for this flight, based on how far
 * away the scheduled departure is.
 *
 * Schedule:
 *   already departed (< 0h)  → check once more in 4 h, then stop
 *   ≤ 3 h until departure    → every 15 min  (gate window)
 *   ≤ 24 h                   → every 1 h     (day-of)
 *   ≤ 72 h  (3 days)         → every 1 h
 *   ≤ 168 h (1 week)         → every 6 h
 *   ≤ 720 h (30 days)        → every 24 h
 *   > 30 days                → every 7 days  (weekly)
 */
export function computeNextFetchAt(scheduledDepartureAt: Date | null): Date {
  const now = new Date();

  if (!scheduledDepartureAt) {
    return addHours(now, 24);
  }

  const hoursUntil = (scheduledDepartureAt.getTime() - now.getTime()) / 3_600_000;

  if (hoursUntil < 0) return addHours(now, 4);
  if (hoursUntil <= 3) return addMinutes(now, 15);
  if (hoursUntil <= 72) return addHours(now, 1);
  if (hoursUntil <= 168) return addHours(now, 6);
  if (hoursUntil <= 720) return addHours(now, 24);
  return addHours(now, 168);
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Find or create a flight_data row for a given flight number + date.
 * Sets nextFetchAt = now so the worker picks it up immediately.
 */
export async function upsertFlightData(flightNumber: string, flightDate: string): Promise<FlightData> {
  const existing = await db
    .select()
    .from(flightData)
    .where(and(eq(flightData.flightNumber, flightNumber), eq(flightData.flightDate, flightDate)))
    .limit(1);

  if (existing[0]) return existing[0];

  const [row] = await db
    .insert(flightData)
    .values({
      flightNumber,
      flightDate,
      nextFetchAt: new Date(), // fetch immediately
    })
    .returning();

  if (!row) throw new Error('flightData insert did not return a row');
  return row;
}

/**
 * Link a trip booking to a flight_data row.
 */
export async function linkBookingToFlightData(bookingId: number, flightDataId: number): Promise<void> {
  await db.update(tripBookings).set({ flightDataId, updatedAt: new Date() }).where(eq(tripBookings.id, bookingId));
}

/**
 * Return flight_data rows due for an API fetch (nextFetchAt <= now AND auto_update_enabled).
 */
export async function getFlightDataDueForFetch(limit = 50): Promise<FlightData[]> {
  return db
    .select()
    .from(flightData)
    .where(and(lte(flightData.nextFetchAt, new Date()), eq(flightData.autoUpdateEnabled, true)))
    .limit(limit);
}

export type FlightDataUpdate = Partial<
  Pick<
    FlightData,
    | 'originIata'
    | 'destinationIata'
    | 'scheduledDepartureAt'
    | 'scheduledArrivalAt'
    | 'actualDepartureAt'
    | 'actualArrivalAt'
    | 'departureTerminal'
    | 'departureGate'
    | 'arrivalTerminal'
    | 'status'
    | 'aircraftType'
    | 'aircraftRegistration'
    | 'airlineIata'
    | 'airlineName'
    | 'rawResponse'
  >
>;

/**
 * Persist API-fetched fields and advance the polling schedule.
 */
export async function updateFlightData(id: number, fields: FlightDataUpdate): Promise<FlightData> {
  const now = new Date();
  const departure = fields.scheduledDepartureAt ?? null;

  const [row] = await db
    .update(flightData)
    .set({
      ...fields,
      lastFetchedAt: now,
      nextFetchAt: computeNextFetchAt(departure),
      updatedAt: now,
    })
    .where(eq(flightData.id, id))
    .returning();

  if (!row) throw new Error(`flightData row ${id} not found`);
  return row;
}

/**
 * Advance nextFetchAt without updating other fields (back-off after failed fetch).
 */
export async function backOffFlightData(id: number, scheduledDepartureAt: Date | null): Promise<void> {
  await db
    .update(flightData)
    .set({ nextFetchAt: computeNextFetchAt(scheduledDepartureAt), updatedAt: new Date() })
    .where(eq(flightData.id, id));
}

export async function setFlightDataAutoUpdate(id: number, enabled: boolean): Promise<void> {
  await db.update(flightData).set({ autoUpdateEnabled: enabled, updatedAt: new Date() }).where(eq(flightData.id, id));
}
