import { and, eq, desc, asc, max, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { apiaryHives, apiaryLogs, apiaryTasks, apiaryYards } from '../../db/schema/apiary';
import type { ApiaryHive, ApiaryLog, ApiaryTask } from '../../types/index';

// ---------------------------------------------------------------------------
// getApiaryHiveStatus — full picture for one hive
// ---------------------------------------------------------------------------

export interface ApiaryHiveStatus {
  hive: ApiaryHive;
  yardName: string | null;
  lastInspection: ApiaryLog | null;
  activeTreatments: ApiaryLog[];
  openTasks: ApiaryTask[];
}

export async function getApiaryHiveStatus(userId: string, hiveId: number): Promise<ApiaryHiveStatus | null> {
  const hive = await db.query.apiaryHives.findFirst({
    where: and(eq(apiaryHives.userId, userId), eq(apiaryHives.id, hiveId)),
  });
  if (!hive) return null;

  let yardName: string | null = null;
  if (hive.yardId) {
    const yard = await db.query.apiaryYards.findFirst({
      where: and(eq(apiaryYards.userId, userId), eq(apiaryYards.id, hive.yardId)),
    });
    yardName = yard?.name ?? null;
  }

  const now = new Date();

  const [lastInspectionRows, treatmentRows, openTaskRows] = await Promise.all([
    db
      .select()
      .from(apiaryLogs)
      .where(and(eq(apiaryLogs.userId, userId), eq(apiaryLogs.hiveId, hiveId), eq(apiaryLogs.type, 'inspection')))
      .orderBy(desc(apiaryLogs.loggedAt))
      .limit(1),
    db
      .select()
      .from(apiaryLogs)
      .where(and(eq(apiaryLogs.userId, userId), eq(apiaryLogs.hiveId, hiveId), eq(apiaryLogs.type, 'treatment')))
      .orderBy(desc(apiaryLogs.loggedAt)),
    db
      .select()
      .from(apiaryTasks)
      .where(and(eq(apiaryTasks.userId, userId), eq(apiaryTasks.hiveId, hiveId), eq(apiaryTasks.completed, false)))
      .orderBy(asc(apiaryTasks.dueAt)),
  ]);

  // Filter active treatments (logged_at + duration_days > now)
  const activeTreatments = treatmentRows.filter((t) => {
    const data = t.data as Record<string, unknown> | null;
    const durationDays = typeof data?.duration_days === 'number' ? data.duration_days : 0;
    if (durationDays <= 0) return false;
    const endDate = new Date(t.loggedAt.getTime() + durationDays * 86400000);
    return endDate > now;
  });

  return {
    hive,
    yardName,
    lastInspection: lastInspectionRows[0] ?? null,
    activeTreatments,
    openTasks: openTaskRows,
  };
}

// ---------------------------------------------------------------------------
// getApiaryActiveTreatments — treatments where logged_at + duration_days > now
// ---------------------------------------------------------------------------

export interface ActiveTreatment {
  logId: number;
  hiveId: number | null;
  hiveName: string | null;
  product: string | null;
  method: string | null;
  loggedAt: Date;
  durationDays: number;
  endDate: Date;
}

export async function getApiaryActiveTreatments(
  userId: string,
  opts: { hiveId?: number } = {},
): Promise<ActiveTreatment[]> {
  const conditions = [eq(apiaryLogs.userId, userId), eq(apiaryLogs.type, 'treatment')];
  if (opts.hiveId !== undefined) conditions.push(eq(apiaryLogs.hiveId, opts.hiveId));

  const rows = await db
    .select({
      logId: apiaryLogs.id,
      hiveId: apiaryLogs.hiveId,
      hiveName: apiaryHives.name,
      data: apiaryLogs.data,
      loggedAt: apiaryLogs.loggedAt,
    })
    .from(apiaryLogs)
    .leftJoin(apiaryHives, eq(apiaryLogs.hiveId, apiaryHives.id))
    .where(and(...conditions))
    .orderBy(desc(apiaryLogs.loggedAt));

  const now = new Date();
  const active: ActiveTreatment[] = [];

  for (const row of rows) {
    const data = row.data as Record<string, unknown> | null;
    const durationDays = typeof data?.duration_days === 'number' ? data.duration_days : 0;
    if (durationDays <= 0) continue;
    const endDate = new Date(row.loggedAt.getTime() + durationDays * 86400000);
    if (endDate <= now) continue;

    active.push({
      logId: row.logId,
      hiveId: row.hiveId,
      hiveName: row.hiveName,
      product: typeof data?.product === 'string' ? data.product : null,
      method: typeof data?.method === 'string' ? data.method : null,
      loggedAt: row.loggedAt,
      durationDays,
      endDate,
    });
  }

  return active;
}

// ---------------------------------------------------------------------------
// getApiaryOverdueInspections — hives where last inspection > N days ago
// ---------------------------------------------------------------------------

export interface OverdueInspection {
  hiveId: number;
  hiveName: string;
  yardName: string | null;
  lastInspectionDate: Date | null;
  daysSinceInspection: number | null;
}

export async function getApiaryOverdueInspections(
  userId: string,
  opts: { thresholdDays?: number } = {},
): Promise<OverdueInspection[]> {
  const thresholdDays = opts.thresholdDays ?? 14;

  // Get all active hives
  const hives = await db
    .select({
      hiveId: apiaryHives.id,
      hiveName: apiaryHives.name,
      yardId: apiaryHives.yardId,
    })
    .from(apiaryHives)
    .where(and(eq(apiaryHives.userId, userId), eq(apiaryHives.isActive, true)));

  if (hives.length === 0) return [];

  // Get yards for name lookup
  const yards = await db.select().from(apiaryYards).where(eq(apiaryYards.userId, userId));
  const yardMap = new Map(yards.map((y) => [y.id, y.name]));

  // Fetch the latest inspection date for ALL hives in a single query
  const latestInspections = await db
    .select({
      hiveId: apiaryLogs.hiveId,
      lastLoggedAt: max(apiaryLogs.loggedAt),
    })
    .from(apiaryLogs)
    .where(and(eq(apiaryLogs.userId, userId), eq(apiaryLogs.type, 'inspection')))
    .groupBy(apiaryLogs.hiveId);

  const inspectionMap = new Map(latestInspections.map((r) => [r.hiveId, r.lastLoggedAt]));

  const now = new Date();
  const overdue: OverdueInspection[] = [];

  for (const hive of hives) {
    const lastDate = inspectionMap.get(hive.hiveId) ?? null;
    const daysSince = lastDate ? Math.floor((now.getTime() - lastDate.getTime()) / 86400000) : null;

    // Hive is overdue if: no inspection ever, or last inspection older than threshold
    if (daysSince === null || daysSince > thresholdDays) {
      overdue.push({
        hiveId: hive.hiveId,
        hiveName: hive.hiveName,
        yardName: hive.yardId ? (yardMap.get(hive.yardId) ?? null) : null,
        lastInspectionDate: lastDate,
        daysSinceInspection: daysSince,
      });
    }
  }

  return overdue;
}

// ---------------------------------------------------------------------------
// moveApiaryHives — bulk relocation: update yard_id + log entry per hive
// ---------------------------------------------------------------------------

export interface MoveApiaryHivesResult {
  movedCount: number;
  logs: ApiaryLog[];
}

export async function moveApiaryHives(
  userId: string,
  opts: { hiveIds: number[]; toYardId: number; reason?: string; movedAt?: Date },
): Promise<MoveApiaryHivesResult> {
  const { hiveIds, toYardId, reason, movedAt } = opts;
  const loggedAt = movedAt ?? new Date();

  if (hiveIds.length === 0) throw new Error('hiveIds must not be empty');

  // Verify the target yard belongs to the user
  const yard = await db.query.apiaryYards.findFirst({
    where: and(eq(apiaryYards.userId, userId), eq(apiaryYards.id, toYardId)),
  });
  if (!yard) throw new Error(`Yard with id ${toYardId} not found`);

  // Verify all hives belong to the user
  const hives = await db
    .select({ id: apiaryHives.id, yardId: apiaryHives.yardId })
    .from(apiaryHives)
    .where(and(eq(apiaryHives.userId, userId), inArray(apiaryHives.id, hiveIds)));

  if (hives.length !== hiveIds.length) {
    const foundIds = new Set(hives.map((h) => h.id));
    const missing = hiveIds.filter((id) => !foundIds.has(id));
    throw new Error(`Hive(s) not found: ${missing.join(', ')}`);
  }

  const fromYardMap = new Map(hives.map((h) => [h.id, h.yardId]));

  // Atomically update all hives to the new yard
  await db
    .update(apiaryHives)
    .set({ yardId: toYardId, updatedAt: new Date() })
    .where(and(eq(apiaryHives.userId, userId), inArray(apiaryHives.id, hiveIds)));

  // Create a relocation log entry for each hive
  const logValues = hiveIds.map((hiveId) => ({
    userId,
    hiveId,
    type: 'relocation' as const,
    loggedAt,
    notes: reason ?? null,
    data: { to_yard_id: toYardId, from_yard_id: fromYardMap.get(hiveId) ?? null, reason: reason ?? null },
  }));

  const logs = await db.insert(apiaryLogs).values(logValues).returning();

  return { movedCount: hiveIds.length, logs };
}

// ---------------------------------------------------------------------------
// getApiaryYardBriefing — "I'm driving to yard X" full picture
// ---------------------------------------------------------------------------

export interface ApiaryYardBriefing {
  yard: { id: number; name: string; location: string | null; notes: string | null };
  hives: ApiaryHive[];
  overdueInspections: OverdueInspection[];
  activeTreatments: ActiveTreatment[];
  hiveTasks: ApiaryTask[];
  yardTasks: ApiaryTask[];
}

export async function getApiaryYardBriefing(userId: string, yardId: number): Promise<ApiaryYardBriefing | null> {
  const yard = await db.query.apiaryYards.findFirst({
    where: and(eq(apiaryYards.userId, userId), eq(apiaryYards.id, yardId)),
  });
  if (!yard) return null;

  // All active hives at this yard
  const hives = await db
    .select()
    .from(apiaryHives)
    .where(and(eq(apiaryHives.userId, userId), eq(apiaryHives.yardId, yardId), eq(apiaryHives.isActive, true)))
    .orderBy(apiaryHives.name);

  const hiveIds = hives.map((h) => h.id);

  if (hiveIds.length === 0) {
    // Yard has no hives — still return yard tasks
    const yardTasks = await db
      .select()
      .from(apiaryTasks)
      .where(and(eq(apiaryTasks.userId, userId), eq(apiaryTasks.yardId, yardId), eq(apiaryTasks.completed, false)))
      .orderBy(asc(apiaryTasks.dueAt));

    return {
      yard: { id: yard.id, name: yard.name, location: yard.location, notes: yard.notes },
      hives: [],
      overdueInspections: [],
      activeTreatments: [],
      hiveTasks: [],
      yardTasks,
    };
  }

  // Overdue inspections among these hives
  const latestInspections = await db
    .select({
      hiveId: apiaryLogs.hiveId,
      lastLoggedAt: max(apiaryLogs.loggedAt),
    })
    .from(apiaryLogs)
    .where(and(eq(apiaryLogs.userId, userId), eq(apiaryLogs.type, 'inspection'), inArray(apiaryLogs.hiveId, hiveIds)))
    .groupBy(apiaryLogs.hiveId);

  const inspectionMap = new Map(latestInspections.map((r) => [r.hiveId, r.lastLoggedAt]));
  const now = new Date();
  const thresholdDays = 14;
  const overdueInspections: OverdueInspection[] = [];

  for (const hive of hives) {
    const lastDate = inspectionMap.get(hive.id) ?? null;
    const daysSince = lastDate ? Math.floor((now.getTime() - lastDate.getTime()) / 86400000) : null;
    if (daysSince === null || daysSince > thresholdDays) {
      overdueInspections.push({
        hiveId: hive.id,
        hiveName: hive.name,
        yardName: yard.name,
        lastInspectionDate: lastDate,
        daysSinceInspection: daysSince,
      });
    }
  }

  // Active treatments among these hives
  const treatmentRows = await db
    .select({
      logId: apiaryLogs.id,
      hiveId: apiaryLogs.hiveId,
      hiveName: apiaryHives.name,
      data: apiaryLogs.data,
      loggedAt: apiaryLogs.loggedAt,
    })
    .from(apiaryLogs)
    .leftJoin(apiaryHives, eq(apiaryLogs.hiveId, apiaryHives.id))
    .where(and(eq(apiaryLogs.userId, userId), eq(apiaryLogs.type, 'treatment'), inArray(apiaryLogs.hiveId, hiveIds)))
    .orderBy(desc(apiaryLogs.loggedAt));

  const activeTreatments: ActiveTreatment[] = [];
  for (const row of treatmentRows) {
    const data = row.data as Record<string, unknown> | null;
    const durationDays = typeof data?.duration_days === 'number' ? data.duration_days : 0;
    if (durationDays <= 0) continue;
    const endDate = new Date(row.loggedAt.getTime() + durationDays * 86400000);
    if (endDate <= now) continue;
    activeTreatments.push({
      logId: row.logId,
      hiveId: row.hiveId,
      hiveName: row.hiveName,
      product: typeof data?.product === 'string' ? data.product : null,
      method: typeof data?.method === 'string' ? data.method : null,
      loggedAt: row.loggedAt,
      durationDays,
      endDate,
    });
  }

  // Open hive-level tasks for these hives + open yard-level tasks
  const [hiveTasks, yardTasks] = await Promise.all([
    db
      .select()
      .from(apiaryTasks)
      .where(
        and(eq(apiaryTasks.userId, userId), inArray(apiaryTasks.hiveId, hiveIds), eq(apiaryTasks.completed, false)),
      )
      .orderBy(asc(apiaryTasks.dueAt)),
    db
      .select()
      .from(apiaryTasks)
      .where(and(eq(apiaryTasks.userId, userId), eq(apiaryTasks.yardId, yardId), eq(apiaryTasks.completed, false)))
      .orderBy(asc(apiaryTasks.dueAt)),
  ]);

  return {
    yard: { id: yard.id, name: yard.name, location: yard.location, notes: yard.notes },
    hives,
    overdueInspections,
    activeTreatments,
    hiveTasks,
    yardTasks,
  };
}
