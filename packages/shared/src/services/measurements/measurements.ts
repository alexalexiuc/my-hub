import { and, desc, eq, between } from 'drizzle-orm';
import { db } from '../../db/client';
import { bodyMeasurements, measurementTypes } from '../../db/schema/measurements';
import type { BodyMeasurement, NewBodyMeasurement } from '../../types/index';

export interface GetMeasurementsFilter {
  typeId?: number;
  typeKey?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export interface MeasurementWithType extends BodyMeasurement {
  typeKey: string;
  typeLabel: string;
  typeUnit: string;
}

export async function logMeasurement(
  data: Omit<NewBodyMeasurement, 'id' | 'createdAt'>,
): Promise<BodyMeasurement> {
  const [row] = await db.insert(bodyMeasurements).values(data).returning();
  if (!row) throw new Error('Insert did not return a row');
  return row;
}

export async function getMeasurements(
  userId: string,
  filter: GetMeasurementsFilter = {},
): Promise<MeasurementWithType[]> {
  const { typeId, dateFrom, dateTo, limit = 100 } = filter;

  const conditions = [eq(bodyMeasurements.userId, userId)];
  if (typeId !== undefined) conditions.push(eq(bodyMeasurements.typeId, typeId));
  if (dateFrom !== undefined && dateTo !== undefined) {
    conditions.push(between(bodyMeasurements.date, dateFrom, dateTo));
  } else if (dateFrom !== undefined) {
    conditions.push(between(bodyMeasurements.date, dateFrom, '9999-12-31'));
  }

  const rows = await db
    .select({
      id: bodyMeasurements.id,
      userId: bodyMeasurements.userId,
      typeId: bodyMeasurements.typeId,
      date: bodyMeasurements.date,
      value: bodyMeasurements.value,
      notes: bodyMeasurements.notes,
      createdAt: bodyMeasurements.createdAt,
      typeKey: measurementTypes.key,
      typeLabel: measurementTypes.label,
      typeUnit: measurementTypes.unit,
    })
    .from(bodyMeasurements)
    .innerJoin(measurementTypes, eq(bodyMeasurements.typeId, measurementTypes.id))
    .where(and(...conditions))
    .orderBy(desc(bodyMeasurements.date), desc(bodyMeasurements.createdAt))
    .limit(limit);

  return rows;
}

/** Returns the latest measurement value for each type the user has recorded */
export async function getLatestMeasurementsPerType(
  userId: string,
): Promise<MeasurementWithType[]> {
  // Get distinct type IDs for this user then fetch latest per type
  const allRows = await db
    .select({
      id: bodyMeasurements.id,
      userId: bodyMeasurements.userId,
      typeId: bodyMeasurements.typeId,
      date: bodyMeasurements.date,
      value: bodyMeasurements.value,
      notes: bodyMeasurements.notes,
      createdAt: bodyMeasurements.createdAt,
      typeKey: measurementTypes.key,
      typeLabel: measurementTypes.label,
      typeUnit: measurementTypes.unit,
    })
    .from(bodyMeasurements)
    .innerJoin(measurementTypes, eq(bodyMeasurements.typeId, measurementTypes.id))
    .where(eq(bodyMeasurements.userId, userId))
    .orderBy(desc(bodyMeasurements.date), desc(bodyMeasurements.createdAt));

  // Keep only the latest entry per typeId
  const seen = new Set<number>();
  const latest: MeasurementWithType[] = [];
  for (const row of allRows) {
    if (!seen.has(row.typeId)) {
      seen.add(row.typeId);
      latest.push(row);
    }
  }
  return latest;
}

export async function deleteAllUserMeasurements(userId: string): Promise<number> {
  const rows = await db
    .delete(bodyMeasurements)
    .where(eq(bodyMeasurements.userId, userId))
    .returning({ id: bodyMeasurements.id });
  return rows.length;
}

export async function deleteMeasurement(
  id: number,
  userId: string,
): Promise<BodyMeasurement | null> {
  const [row] = await db
    .delete(bodyMeasurements)
    .where(and(eq(bodyMeasurements.id, id), eq(bodyMeasurements.userId, userId)))
    .returning();
  return row ?? null;
}
