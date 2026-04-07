import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { apiaryYards } from '../../db/schema/apiary';
import type { ApiaryYard } from '../../types';

export type YardInsert = Omit<typeof apiaryYards.$inferInsert, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
export type YardUpdate = Partial<Omit<typeof apiaryYards.$inferInsert, 'id' | 'userId' | 'createdAt'>>;

export async function getApiaryYards(userId: string): Promise<ApiaryYard[]> {
  return db.select().from(apiaryYards).where(eq(apiaryYards.userId, userId)).orderBy(apiaryYards.name);
}

export async function getApiaryYard(userId: string, yardId: number): Promise<ApiaryYard | undefined> {
  return db.query.apiaryYards.findFirst({
    where: and(eq(apiaryYards.userId, userId), eq(apiaryYards.id, yardId)),
  });
}

export async function createApiaryYard(userId: string, data: YardInsert): Promise<ApiaryYard> {
  const [row] = await db
    .insert(apiaryYards)
    .values({ ...data, userId })
    .returning();
  if (!row) throw new Error('Insert did not return a row');
  return row;
}

export async function updateApiaryYard(userId: string, yardId: number, data: YardUpdate): Promise<ApiaryYard | null> {
  const [row] = await db
    .update(apiaryYards)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(apiaryYards.userId, userId), eq(apiaryYards.id, yardId)))
    .returning();
  return row ?? null;
}

export async function deleteApiaryYard(userId: string, yardId: number): Promise<ApiaryYard | null> {
  const [row] = await db
    .delete(apiaryYards)
    .where(and(eq(apiaryYards.userId, userId), eq(apiaryYards.id, yardId)))
    .returning();
  return row ?? null;
}

export async function deleteAllUserApiaryYards(userId: string): Promise<number> {
  const rows = await db.delete(apiaryYards).where(eq(apiaryYards.userId, userId)).returning({ id: apiaryYards.id });
  return rows.length;
}
