import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { tripBookings, tripDocuments } from '../../db/schema/travel';
import { omitNullish } from '../../utils/index';
import type { NewTripDocument, TripDocument } from '../../types/index';
import { getTripByIdAccessible, verifyTripOwnership } from './trips';

export type TripDocumentInsert = Omit<NewTripDocument, 'id' | 'userId' | 'tripId' | 'createdAt' | 'updatedAt'>;
export type TripDocumentUpdate = Partial<
  Pick<
    TripDocumentInsert,
    | 'type'
    | 'title'
    | 'notes'
    | 'sourceUrl'
    | 'originalName'
    | 'mimeType'
    | 'byteSize'
    | 'storagePath'
    | 'publicUrl'
    | 'bookingId'
  >
>;

async function assertBookingBelongsToTripOwner(userId: string, tripId: number, bookingId: number): Promise<void> {
  const [booking] = await db
    .select({ id: tripBookings.id })
    .from(tripBookings)
    .where(and(eq(tripBookings.id, bookingId), eq(tripBookings.tripId, tripId), eq(tripBookings.userId, userId)));

  if (!booking) {
    throw new Error('booking_id does not belong to this trip');
  }
}

export async function addTripDocument(userId: string, tripId: number, data: TripDocumentInsert): Promise<TripDocument> {
  if (!(await verifyTripOwnership(userId, tripId))) {
    throw new Error('Trip not found');
  }

  if (typeof data.bookingId === 'number') {
    await assertBookingBelongsToTripOwner(userId, tripId, data.bookingId);
  }

  const [row] = await db
    .insert(tripDocuments)
    .values({
      ...data,
      userId,
      tripId,
    })
    .returning();

  if (!row) throw new Error('Insert did not return a row');
  return row;
}

export async function getTripDocuments(userId: string, tripId: number): Promise<TripDocument[]> {
  return db
    .select()
    .from(tripDocuments)
    .where(and(eq(tripDocuments.userId, userId), eq(tripDocuments.tripId, tripId)))
    .orderBy(asc(tripDocuments.id));
}

export async function getTripDocumentById(userId: string, documentId: number): Promise<TripDocument | null> {
  const [row] = await db.select().from(tripDocuments).where(eq(tripDocuments.id, documentId));
  if (!row) return null;

  const canAccess = await getTripByIdAccessible(userId, row.tripId);
  return canAccess ? row : null;
}

export async function updateTripDocument(
  userId: string,
  documentId: number,
  data: TripDocumentUpdate,
): Promise<TripDocument | null> {
  if (typeof data.bookingId === 'number') {
    const [existing] = await db
      .select({ tripId: tripDocuments.tripId })
      .from(tripDocuments)
      .where(and(eq(tripDocuments.userId, userId), eq(tripDocuments.id, documentId)));

    if (!existing) return null;
    await assertBookingBelongsToTripOwner(userId, existing.tripId, data.bookingId);
  }

  const [row] = await db
    .update(tripDocuments)
    .set({
      ...omitNullish(data),
      updatedAt: new Date(),
    })
    .where(and(eq(tripDocuments.userId, userId), eq(tripDocuments.id, documentId)))
    .returning();

  return row ?? null;
}

export async function deleteTripDocument(userId: string, documentId: number): Promise<TripDocument | null> {
  const [row] = await db
    .delete(tripDocuments)
    .where(and(eq(tripDocuments.userId, userId), eq(tripDocuments.id, documentId)))
    .returning();

  return row ?? null;
}

export async function deleteAllUserTripDocuments(userId: string): Promise<number> {
  const rows = await db
    .delete(tripDocuments)
    .where(eq(tripDocuments.userId, userId))
    .returning({ id: tripDocuments.id });

  return rows.length;
}
