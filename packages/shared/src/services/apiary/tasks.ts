import { and, eq, asc, lte } from 'drizzle-orm';
import { db } from '../../db/client';
import { apiaryTasks } from '../../db/schema/apiary';
import type { ApiaryTask } from '../../types/index';

export type ApiaryTaskInsert = Omit<typeof apiaryTasks.$inferInsert, 'id' | 'userId' | 'createdAt'>;
export type ApiaryTaskUpdate = Partial<Pick<typeof apiaryTasks.$inferInsert, 'title' | 'completed' | 'dueAt'>>;

export interface GetApiaryTasksOpts {
  hiveId?: number;
  yardId?: number;
  completed?: boolean;
  dueBefore?: Date;
  limit?: number;
}

export async function getApiaryTasks(userId: string, opts: GetApiaryTasksOpts = {}): Promise<ApiaryTask[]> {
  const conditions = [eq(apiaryTasks.userId, userId)];
  if (opts.hiveId !== undefined) conditions.push(eq(apiaryTasks.hiveId, opts.hiveId));
  if (opts.yardId !== undefined) conditions.push(eq(apiaryTasks.yardId, opts.yardId));
  if (opts.completed !== undefined) conditions.push(eq(apiaryTasks.completed, opts.completed));
  if (opts.dueBefore !== undefined) conditions.push(lte(apiaryTasks.dueAt, opts.dueBefore));

  const limit = opts.limit ?? 100;

  return db
    .select()
    .from(apiaryTasks)
    .where(and(...conditions))
    .orderBy(asc(apiaryTasks.dueAt))
    .limit(limit);
}

export async function createApiaryTask(userId: string, data: ApiaryTaskInsert): Promise<ApiaryTask> {
  if (data.hiveId && data.yardId) {
    throw new Error('A task cannot be tied to both a hive and a yard. Provide hive_id or yard_id, not both.');
  }
  const [row] = await db
    .insert(apiaryTasks)
    .values({ ...data, userId })
    .returning();
  if (!row) throw new Error('Insert did not return a row');
  return row;
}

export async function updateApiaryTask(
  userId: string,
  taskId: number,
  data: ApiaryTaskUpdate,
): Promise<ApiaryTask | null> {
  const [row] = await db
    .update(apiaryTasks)
    .set(data)
    .where(and(eq(apiaryTasks.userId, userId), eq(apiaryTasks.id, taskId)))
    .returning();
  return row ?? null;
}

export async function deleteApiaryTask(userId: string, taskId: number): Promise<ApiaryTask | null> {
  const [row] = await db
    .delete(apiaryTasks)
    .where(and(eq(apiaryTasks.userId, userId), eq(apiaryTasks.id, taskId)))
    .returning();
  return row ?? null;
}
