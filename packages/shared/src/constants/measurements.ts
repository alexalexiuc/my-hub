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
