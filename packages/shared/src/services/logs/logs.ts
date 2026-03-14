import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "../../db/client";
import { apiRequestLogs } from "../../db/schema/api-request-logs";
import type { ApiRequestLog, NewApiRequestLog } from "../../types/index";

// ---------------------------------------------------------------------------
// API Request Log service
// ---------------------------------------------------------------------------

export type PutLogData = Omit<NewApiRequestLog, "id" | "createdAt">;

export interface GetLogsFilter {
  service?: string;
  userId?: string;
  statusCode?: number;
  from?: Date;
  to?: Date;
  /** Defaults to 100 */
  limit?: number;
}

export async function putLog(data: PutLogData): Promise<ApiRequestLog> {
  const [row] = await db.insert(apiRequestLogs).values(data).returning();
  if (!row) throw new Error("Insert did not return a row");
  return row;
}

export async function getLogs(filter: GetLogsFilter = {}): Promise<ApiRequestLog[]> {
  const { service, userId, statusCode, from, to, limit = 100 } = filter;

  return db
    .select()
    .from(apiRequestLogs)
    .where(
      and(
        service !== undefined ? eq(apiRequestLogs.service, service) : undefined,
        userId !== undefined ? eq(apiRequestLogs.userId, userId) : undefined,
        statusCode !== undefined ? eq(apiRequestLogs.statusCode, statusCode) : undefined,
        from !== undefined ? gte(apiRequestLogs.createdAt, from) : undefined,
        to !== undefined ? lte(apiRequestLogs.createdAt, to) : undefined,
      ),
    )
    .orderBy(desc(apiRequestLogs.createdAt))
    .limit(limit);
}

/** Retention cleanup — remove logs older than `olderThanDays` (default 30). */
export async function deleteOldLogs(olderThanDays = 30): Promise<void> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  await db.delete(apiRequestLogs).where(lte(apiRequestLogs.createdAt, cutoff));
}
