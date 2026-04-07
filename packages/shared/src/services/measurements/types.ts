import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { measurementTypes } from '../../db/schema/measurements';
import type { MeasurementTypeKey } from '../../db/schema/measurements';
import type { MeasurementType } from '../../types';

export async function getMeasurementTypes(): Promise<MeasurementType[]> {
  return db.select().from(measurementTypes).orderBy(measurementTypes.key);
}

export async function getMeasurementTypeByKey(key: MeasurementTypeKey): Promise<MeasurementType | undefined> {
  return db.query.measurementTypes.findFirst({
    where: eq(measurementTypes.key, key),
  });
}
