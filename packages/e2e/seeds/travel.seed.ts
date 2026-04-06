import postgres from 'postgres';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { users, trips, tripShares, tripBookings } from '@my-hub/shared/schema';

const SHARED_OWNER_EMAIL = 'e2e-shared-owner@test.local';

export const SHARED_TRIP_FIXTURE = {
  tripName: 'E2E Shared View Trip',
  ownerName: 'E2E Shared Owner',
  bookingTitle: 'E2E Shared Booking',
} as const;

export interface SharedTripFixture {
  tripName: string;
  ownerName: string;
  bookingTitle: string;
}

export async function seedSharedTripFixture(viewerEmail: string): Promise<SharedTripFixture> {
  const databaseUrl = process.env['E2E_DATABASE_URL'] ?? process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error('E2E_DATABASE_URL (or DATABASE_URL) is required to seed shared travel fixtures');
  }

  const sqlClient = postgres(databaseUrl);
  const db = drizzle(sqlClient, { schema: { users, trips, tripShares, tripBookings } });

  const ownerName = SHARED_TRIP_FIXTURE.ownerName;
  const tripName = SHARED_TRIP_FIXTURE.tripName;
  const bookingTitle = SHARED_TRIP_FIXTURE.bookingTitle;

  try {
    const normalizedViewerEmail = viewerEmail.trim().toLowerCase();
    const normalizedOwnerEmail = SHARED_OWNER_EMAIL.toLowerCase();

    const viewer = await db.query.users.findFirst({ where: eq(users.email, normalizedViewerEmail) });
    if (!viewer) {
      throw new Error(`Unable to find viewer user by email: ${viewerEmail}`);
    }

    const [owner] = await db
      .insert(users)
      .values({
        email: normalizedOwnerEmail,
        name: ownerName,
        passwordHash: null,
        googleId: null,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          name: ownerName,
          active: true,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!owner) {
      throw new Error('Unable to create or update shared-trip owner');
    }

    const existingTrips = await db
      .select({ id: trips.id })
      .from(trips)
      .where(and(eq(trips.userId, owner.id), eq(trips.name, tripName)));

    for (const existing of existingTrips) {
      await db.delete(tripShares).where(eq(tripShares.tripId, existing.id));
      await db.delete(trips).where(eq(trips.id, existing.id));
    }

    const [sharedTrip] = await db
      .insert(trips)
      .values({
        userId: owner.id,
        name: tripName,
        destination: 'Barcelona',
        notes: 'Seeded shared trip for e2e',
      })
      .returning();

    if (!sharedTrip) {
      throw new Error('Unable to create shared trip fixture');
    }

    await db.insert(tripBookings).values({
      userId: owner.id,
      tripId: sharedTrip.id,
      bookingType: 'accommodation',
      title: bookingTitle,
      provider: 'Seeded Hotel',
      startAt: new Date('2026-06-10T14:00:00.000Z'),
      endAt: new Date('2026-06-12T10:00:00.000Z'),
      notes: 'Seeded booking for read-only checks',
    });

    await db.insert(tripShares).values({
      ownerUserId: owner.id,
      tripId: sharedTrip.id,
      sharedWithUserId: viewer.id,
      permission: 'view',
    });

    return { tripName, ownerName, bookingTitle };
  } finally {
    await sqlClient.end();
  }
}
