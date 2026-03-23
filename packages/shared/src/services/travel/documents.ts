import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { tripDocuments } from '../../db/schema/travel';
import { omitNullish } from '../../utils/index';
import type { NewTripDocument, TripDocument } from '../../types/index';

export type TripDocumentInsert = Omit<NewTripDocument, 'id' | 'userId' | 'tripId' | 'createdAt' | 'updatedAt'>;
export type TripDocumentUpdate = Partial<
  Pick<
    TripDocumentInsert,
    'type' | 'title' | 'notes' | 'sourceUrl' | 'originalName' | 'mimeType' | 'byteSize' | 'storagePath' | 'publicUrl'
  >
>;

export async function addTripDocument(userId: string, tripId: number, data: TripDocumentInsert): Promise<TripDocument> {
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
  const [row] = await db
    .select()
    .from(tripDocuments)
    .where(and(eq(tripDocuments.userId, userId), eq(tripDocuments.id, documentId)));

  return row ?? null;
}

export async function updateTripDocument(
  userId: string,
  documentId: number,
  data: TripDocumentUpdate,
): Promise<TripDocument | null> {
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
