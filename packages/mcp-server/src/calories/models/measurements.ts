import type { MeasurementWithType } from '@my-hub/shared/services';
import type { MeasurementEntry } from '../types';

export function rowToMeasurementEntry(row: MeasurementWithType): MeasurementEntry {
  return {
    id: row.id,
    type: row.typeKey,
    label: row.typeLabel,
    value: row.value,
    unit: row.typeUnit,
    date: row.date,
    notes: row.notes ?? null,
  };
}
