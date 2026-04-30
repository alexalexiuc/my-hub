/**
 * Body measurement keys used in profile and measurement logs.
 */
export const MeasurementTypes = {
  Weight: 'weight',
  Height: 'height',
  Neck: 'neck',
  Waist: 'waist',
  Hips: 'hips',
  Chest: 'chest',
  Bicep: 'bicep',
  BodyFat: 'body_fat',
} as const;

export type MeasurementTypeKey = (typeof MeasurementTypes)[keyof typeof MeasurementTypes];
export const measurementTypeKeys = Object.values(MeasurementTypes) as MeasurementTypeKey[];

/** Tracks the origin of a measurement row — reusable across tables that need provenance tracking. */
export const MeasurementEntrySources = {
  hub: 'hub',
  automation: 'automation',
  mcp: 'mcp',
} as const;

export type MeasurementEntrySource = (typeof MeasurementEntrySources)[keyof typeof MeasurementEntrySources];
export const measurementEntrySourceValues = Object.values(MeasurementEntrySources) as MeasurementEntrySource[];
