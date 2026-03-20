import { and, eq, asc } from 'drizzle-orm';
import { db } from '../../db/client';
import { apiaryTasks } from '../../db/schema/apiary';
import type { ApiaryTask } from '../../types/index';

export type ApiaryTaskInsert = Omit<typeof apiaryTasks.$inferInsert, 'id' | 'userId' | 'createdAt'>;
export type ApiaryTaskUpdate = Partial<Pick<typeof apiaryTasks.$inferInsert, 'title' | 'completed' | 'dueAt'>>;

export interface GetApiaryTasksOpts {
  hiveId?: number;
  completed?: boolean;
  limit?: number;
}

export async function getApiaryTasks(userId: string, opts: GetApiaryTasksOpts = {}): Promise<ApiaryTask[]> {
  const conditions = [eq(apiaryTasks.userId, userId)];
  if (opts.hiveId !== undefined) conditions.push(eq(apiaryTasks.hiveId, opts.hiveId));
  if (opts.completed !== undefined) conditions.push(eq(apiaryTasks.completed, opts.completed));

  const limit = opts.limit ?? 100;

  return db
    .select()
    .from(apiaryTasks)
    .where(and(...conditions))
    .orderBy(asc(apiaryTasks.dueAt))
    .limit(limit);
}

export async function createApiaryTask(userId: string, data: ApiaryTaskInsert): Promise<ApiaryTask> {
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
