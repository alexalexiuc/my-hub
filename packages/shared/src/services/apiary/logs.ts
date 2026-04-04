import { and, eq, desc } from 'drizzle-orm';
import { db } from '../../db/client';
import { apiaryLogs } from '../../db/schema/apiary';
import type { ApiaryLog } from '../../types/index';

export type ApiaryLogInsert = Omit<typeof apiaryLogs.$inferInsert, 'id' | 'userId' | 'createdAt'>;

export interface GetApiaryLogsOpts {
  hiveId?: number;
  type?: string;
  limit?: number;
  offset?: number;
}

export async function getApiaryLogs(userId: string, opts: GetApiaryLogsOpts = {}): Promise<ApiaryLog[]> {
  const conditions = [eq(apiaryLogs.userId, userId)];
  if (opts.hiveId !== undefined) conditions.push(eq(apiaryLogs.hiveId, opts.hiveId));
  if (opts.type !== undefined) conditions.push(eq(apiaryLogs.type, opts.type));

  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;

  return db
    .select()
    .from(apiaryLogs)
    .where(and(...conditions))
    .orderBy(desc(apiaryLogs.loggedAt))
    .limit(limit)
    .offset(offset);
}

export async function getApiaryLog(userId: string, logId: number): Promise<ApiaryLog | undefined> {
  return db.query.apiaryLogs.findFirst({
    where: and(eq(apiaryLogs.userId, userId), eq(apiaryLogs.id, logId)),
  });
}

export async function createApiaryLog(userId: string, data: ApiaryLogInsert): Promise<ApiaryLog> {
  const [row] = await db
    .insert(apiaryLogs)
    .values({ ...data, userId })
    .returning();
  if (!row) throw new Error('Insert did not return a row');
  return row;
}

export async function deleteApiaryLog(userId: string, logId: number): Promise<ApiaryLog | null> {
  const [row] = await db
    .delete(apiaryLogs)
    .where(and(eq(apiaryLogs.userId, userId), eq(apiaryLogs.id, logId)))
    .returning();
  return row ?? null;
}

export async function deleteAllUserApiaryLogs(userId: string): Promise<number> {
  const rows = await db.delete(apiaryLogs).where(eq(apiaryLogs.userId, userId)).returning({ id: apiaryLogs.id });
  return rows.length;
}
