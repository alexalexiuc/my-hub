import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { measurementTypes } from '../../db/schema/measurements';
import type { MeasurementType } from '../../types/index';

export async function getMeasurementTypes(): Promise<MeasurementType[]> {
  return db.select().from(measurementTypes).orderBy(measurementTypes.id);
}

export async function getMeasurementTypeByKey(key: string): Promise<MeasurementType | undefined> {
  return db.query.measurementTypes.findFirst({
    where: eq(measurementTypes.key, key),
  });
}

export async function getMeasurementTypeById(id: number): Promise<MeasurementType | undefined> {
  return db.query.measurementTypes.findFirst({
    where: eq(measurementTypes.id, id),
  });
}
