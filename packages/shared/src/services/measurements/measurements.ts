/**
 * Body measurement service.
 *
 * Exports:
 *   logMeasurement       — inserts a single body measurement row
 *   logMeasurementsBatch — inserts multiple measurements sharing one createdAt timestamp
 *   getMeasurements      — fetches measurements with type/date/entrySource filters
 *   getLatestMeasurementsPerType — latest value per measurement type for a user
 *   deleteMeasurement    — deletes a single measurement by id + userId
 *   deleteAllUserMeasurements — bulk delete all measurements for a user
 */
import { and, desc, eq, between } from 'drizzle-orm';
import { db } from '../../db/client';
import { bodyMeasurements } from '../../db/schema/measurements';
import type { MeasurementTypeKey, MeasurementEntrySource } from '../../db/schema/measurements';
import type { BodyMeasurement, NewBodyMeasurement } from '../../types';
import { measurementTypeDefinitionsByKey } from '../../constants';

export interface GetMeasurementsFilter {
  typeKey?: MeasurementTypeKey;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  entrySource?: MeasurementEntrySource;
}

export interface MeasurementWithType extends BodyMeasurement {
  typeLabel: string;
  typeUnit: string;
}

function withTypeMetadata(row: BodyMeasurement): MeasurementWithType {
  const type = measurementTypeDefinitionsByKey[row.typeKey];
  return {
    ...row,
    value: roundMeasurementValue(row.value),
    typeLabel: type.label,
    typeUnit: type.unit,
  };
}

/** Rounds a measurement value to 4 decimal places to avoid IEEE 754 floating-point artifacts. */
function roundMeasurementValue(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export async function logMeasurement(data: Omit<NewBodyMeasurement, 'id' | 'createdAt'>): Promise<BodyMeasurement> {
  const [row] = await db
    .insert(bodyMeasurements)
    .values({ ...data, value: roundMeasurementValue(data.value) })
    .returning();
  if (!row) throw new Error('Insert did not return a row');
  return { ...row, value: roundMeasurementValue(row.value) };
}

/**
 * Inserts multiple measurements in one query, all sharing the same createdAt
 * timestamp. Used by the automation endpoint to keep batch entries correlated.
 */
export async function logMeasurementsBatch(
  userId: string,
  items: Array<{ typeKey: MeasurementTypeKey; value: number; date: string; notes?: string }>,
  entrySource: MeasurementEntrySource,
): Promise<BodyMeasurement[]> {
  const now = new Date();
  const rows = await db
    .insert(bodyMeasurements)
    .values(
      items.map(item => ({
        userId,
        typeKey: item.typeKey,
        value: roundMeasurementValue(item.value),
        date: item.date,
        notes: item.notes,
        entrySource,
        createdAt: now,
      })),
    )
    .returning();
  return rows.map(row => ({ ...row, value: roundMeasurementValue(row.value) }));
}

export async function getMeasurements(
  userId: string,
  filter: GetMeasurementsFilter = {},
): Promise<MeasurementWithType[]> {
  const { typeKey, dateFrom, dateTo, limit = 100, entrySource } = filter;

  const conditions = [eq(bodyMeasurements.userId, userId)];
  if (typeKey !== undefined) conditions.push(eq(bodyMeasurements.typeKey, typeKey));
  if (entrySource !== undefined) conditions.push(eq(bodyMeasurements.entrySource, entrySource));
  if (dateFrom !== undefined && dateTo !== undefined) {
    conditions.push(between(bodyMeasurements.date, dateFrom, dateTo));
  } else if (dateFrom !== undefined) {
    conditions.push(between(bodyMeasurements.date, dateFrom, '9999-12-31'));
  } else if (dateTo !== undefined) {
    conditions.push(between(bodyMeasurements.date, '0001-01-01', dateTo));
  }

  const rows = await db
    .select({
      id: bodyMeasurements.id,
      userId: bodyMeasurements.userId,
      typeKey: bodyMeasurements.typeKey,
      date: bodyMeasurements.date,
      value: bodyMeasurements.value,
      notes: bodyMeasurements.notes,
      entrySource: bodyMeasurements.entrySource,
      createdAt: bodyMeasurements.createdAt,
    })
    .from(bodyMeasurements)
    .where(and(...conditions))
    .orderBy(desc(bodyMeasurements.date), desc(bodyMeasurements.createdAt))
    .limit(limit);

  return rows.map(withTypeMetadata);
}

/** Returns the latest measurement value for each type the user has recorded */
export async function getLatestMeasurementsPerType(userId: string): Promise<MeasurementWithType[]> {
  const allRows = await db
    .select({
      id: bodyMeasurements.id,
      userId: bodyMeasurements.userId,
      typeKey: bodyMeasurements.typeKey,
      date: bodyMeasurements.date,
      value: bodyMeasurements.value,
      notes: bodyMeasurements.notes,
      entrySource: bodyMeasurements.entrySource,
      createdAt: bodyMeasurements.createdAt,
    })
    .from(bodyMeasurements)
    .where(eq(bodyMeasurements.userId, userId))
    .orderBy(desc(bodyMeasurements.date), desc(bodyMeasurements.createdAt));

  // Keep only the latest entry per typeKey
  const seen = new Set<MeasurementTypeKey>();
  const latest: MeasurementWithType[] = [];
  for (const row of allRows) {
    if (!seen.has(row.typeKey)) {
      seen.add(row.typeKey);
      latest.push(withTypeMetadata(row));
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

export async function deleteMeasurement(id: number, userId: string): Promise<BodyMeasurement | null> {
  const [row] = await db
    .delete(bodyMeasurements)
    .where(and(eq(bodyMeasurements.id, id), eq(bodyMeasurements.userId, userId)))
    .returning();
  return row ?? null;
}
