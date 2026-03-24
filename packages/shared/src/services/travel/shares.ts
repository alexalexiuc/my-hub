import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { users } from '../../db/schema/users';
import { tripShares } from '../../db/schema/travel';
import type { TripShare } from '../../types/index';
import { verifyTripOwnership } from './trips';

export interface TripShareWithUser {
  share: TripShare;
  userName: string | null;
  userEmail: string;
}

export async function listTripShares(ownerUserId: string, tripId: number): Promise<TripShareWithUser[]> {
  const rows = await db
    .select({
      share: tripShares,
      userName: users.name,
      userEmail: users.email,
    })
    .from(tripShares)
    .innerJoin(users, eq(users.id, tripShares.sharedWithUserId))
    .where(and(eq(tripShares.ownerUserId, ownerUserId), eq(tripShares.tripId, tripId)))
    .orderBy(asc(users.email));

  return rows.map((row) => ({
    share: row.share,
    userName: row.userName,
    userEmail: row.userEmail,
  }));
}

export async function createTripShare(
  ownerUserId: string,
  tripId: number,
  sharedWithUserId: string,
): Promise<TripShare> {
  const isOwner = await verifyTripOwnership(ownerUserId, tripId);
  if (!isOwner) {
    throw new Error('Trip not found');
  }

  if (ownerUserId === sharedWithUserId) {
    throw new Error('Cannot share with yourself');
  }

  const [row] = await db
    .insert(tripShares)
    .values({
      ownerUserId,
      tripId,
      sharedWithUserId,
      permission: 'view',
    })
    .onConflictDoNothing()
    .returning();

  if (row) return row;

  const [existing] = await db
    .select()
    .from(tripShares)
    .where(
      and(
        eq(tripShares.ownerUserId, ownerUserId),
        eq(tripShares.tripId, tripId),
        eq(tripShares.sharedWithUserId, sharedWithUserId),
      ),
    );

  if (!existing) throw new Error('Failed to create trip share');
  return existing;
}

export async function deleteTripShare(ownerUserId: string, tripId: number, shareId: number): Promise<TripShare | null> {
  const [row] = await db
    .delete(tripShares)
    .where(and(eq(tripShares.id, shareId), eq(tripShares.tripId, tripId), eq(tripShares.ownerUserId, ownerUserId)))
    .returning();

  return row ?? null;
}
