import { and, eq, asc, desc, count } from 'drizzle-orm';
import { db } from '../../db/client';
import { apiaryYards, apiaryHives, apiaryLogs, apiaryTasks } from '../../db/schema/apiary';

export interface ApiarySummary {
  yardCount: number;
  hiveCount: number;
  pendingTaskCount: number;
  recentLogs: {
    id: number;
    hiveId: number | null;
    hiveName: string | null;
    type: string;
    notes: string | null;
    loggedAt: Date;
  }[];
  upcomingTasks: {
    id: number;
    title: string;
    hiveId: number | null;
    hiveName: string | null;
    dueAt: Date | null;
  }[];
}

export async function getApiarySummary(userId: string): Promise<ApiarySummary> {
  const [yardCountResult, hiveCountResult, taskCountResult] = await Promise.all([
    db.select({ value: count() }).from(apiaryYards).where(eq(apiaryYards.userId, userId)),
    db
      .select({ value: count() })
      .from(apiaryHives)
      .where(and(eq(apiaryHives.userId, userId), eq(apiaryHives.isActive, true))),
    db
      .select({ value: count() })
      .from(apiaryTasks)
      .where(and(eq(apiaryTasks.userId, userId), eq(apiaryTasks.completed, false))),
  ]);

  const recentLogRows = await db
    .select({
      id: apiaryLogs.id,
      hiveId: apiaryLogs.hiveId,
      hiveName: apiaryHives.name,
      type: apiaryLogs.type,
      notes: apiaryLogs.notes,
      loggedAt: apiaryLogs.loggedAt,
    })
    .from(apiaryLogs)
    .leftJoin(apiaryHives, eq(apiaryLogs.hiveId, apiaryHives.id))
    .where(eq(apiaryLogs.userId, userId))
    .orderBy(desc(apiaryLogs.loggedAt))
    .limit(5);

  const upcomingTaskRows = await db
    .select({
      id: apiaryTasks.id,
      title: apiaryTasks.title,
      hiveId: apiaryTasks.hiveId,
      hiveName: apiaryHives.name,
      dueAt: apiaryTasks.dueAt,
    })
    .from(apiaryTasks)
    .leftJoin(apiaryHives, eq(apiaryTasks.hiveId, apiaryHives.id))
    .where(and(eq(apiaryTasks.userId, userId), eq(apiaryTasks.completed, false)))
    .orderBy(asc(apiaryTasks.dueAt))
    .limit(5);

  return {
    yardCount: yardCountResult[0]?.value ?? 0,
    hiveCount: hiveCountResult[0]?.value ?? 0,
    pendingTaskCount: taskCountResult[0]?.value ?? 0,
    recentLogs: recentLogRows,
    upcomingTasks: upcomingTaskRows,
  };
}
