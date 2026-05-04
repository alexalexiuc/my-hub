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
  Steps: 'steps',
} as const;

export type MeasurementTypeKey = (typeof MeasurementTypes)[keyof typeof MeasurementTypes];
export const measurementTypeKeys = Object.values(MeasurementTypes) as MeasurementTypeKey[];

export type MeasurementTypeDefinition = {
  key: MeasurementTypeKey;
  label: string;
  unit: string;
};

export const measurementTypeDefinitionsByKey = {
  [MeasurementTypes.Bicep]: { label: 'Bicep', unit: 'cm' },
  [MeasurementTypes.BodyFat]: { label: 'Body fat', unit: '%' },
  [MeasurementTypes.Chest]: { label: 'Chest', unit: 'cm' },
  [MeasurementTypes.Height]: { label: 'Height', unit: 'cm' },
  [MeasurementTypes.Hips]: { label: 'Hips', unit: 'cm' },
  [MeasurementTypes.Neck]: { label: 'Neck', unit: 'cm' },
  [MeasurementTypes.Steps]: { label: 'Steps', unit: 'steps' },
  [MeasurementTypes.Waist]: { label: 'Waist', unit: 'cm' },
  [MeasurementTypes.Weight]: { label: 'Weight', unit: 'kg' },
} satisfies Record<MeasurementTypeKey, Omit<MeasurementTypeDefinition, 'key'>>;

export const measurementTypeDefinitions: MeasurementTypeDefinition[] = Object.entries(
  measurementTypeDefinitionsByKey,
).map(([key, value]) => ({ key: key as MeasurementTypeKey, ...value }));

/** Tracks the origin of a measurement row — reusable across tables that need provenance tracking. */
export const MeasurementEntrySources = {
  hub: 'hub',
  automation: 'automation',
  mcp: 'mcp',
} as const;

export type MeasurementEntrySource = (typeof MeasurementEntrySources)[keyof typeof MeasurementEntrySources];
export const measurementEntrySourceValues = Object.values(MeasurementEntrySources) as MeasurementEntrySource[];
