import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { apiaryHives } from '../../db/schema/apiary';
import type { ApiaryHive } from '../../types/index';

export type HiveInsert = Omit<typeof apiaryHives.$inferInsert, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
export type HiveUpdate = Partial<Omit<typeof apiaryHives.$inferInsert, 'id' | 'userId' | 'createdAt'>>;

export interface GetHivesOpts {
  yardId?: number;
  active?: boolean;
}

export async function getApiaryHives(userId: string, opts: GetHivesOpts = {}): Promise<ApiaryHive[]> {
  const conditions = [eq(apiaryHives.userId, userId)];
  if (opts.yardId !== undefined) conditions.push(eq(apiaryHives.yardId, opts.yardId));
  if (opts.active !== undefined) conditions.push(eq(apiaryHives.isActive, opts.active));

  return db
    .select()
    .from(apiaryHives)
    .where(and(...conditions))
    .orderBy(apiaryHives.name);
}

export async function getApiaryHive(userId: string, hiveId: number): Promise<ApiaryHive | undefined> {
  return db.query.apiaryHives.findFirst({
    where: and(eq(apiaryHives.userId, userId), eq(apiaryHives.id, hiveId)),
  });
}

export async function createApiaryHive(userId: string, data: HiveInsert): Promise<ApiaryHive> {
  const [row] = await db
    .insert(apiaryHives)
    .values({ ...data, userId })
    .returning();
  if (!row) throw new Error('Insert did not return a row');
  return row;
}

export async function updateApiaryHive(userId: string, hiveId: number, data: HiveUpdate): Promise<ApiaryHive | null> {
  const [row] = await db
    .update(apiaryHives)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(apiaryHives.userId, userId), eq(apiaryHives.id, hiveId)))
    .returning();
  return row ?? null;
}

export async function deleteApiaryHive(userId: string, hiveId: number): Promise<ApiaryHive | null> {
  const [row] = await db
    .delete(apiaryHives)
    .where(and(eq(apiaryHives.userId, userId), eq(apiaryHives.id, hiveId)))
    .returning();
  return row ?? null;
}

export async function deleteAllUserApiaryHives(userId: string): Promise<number> {
  const rows = await db.delete(apiaryHives).where(eq(apiaryHives.userId, userId)).returning({ id: apiaryHives.id });
  return rows.length;
}
