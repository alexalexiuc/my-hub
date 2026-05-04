import { describe, expect, it } from 'vitest';
import { MeasurementTypes, measurementTypeDefinitions } from './measurements';

describe('measurementTypeDefinitions', () => {
  it('includes each MeasurementTypes key exactly once', () => {
    const expectedKeys = Object.values(MeasurementTypes);
    const actualKeys = measurementTypeDefinitions.map(def => def.key);

    expect(new Set(actualKeys)).toEqual(new Set(expectedKeys));
    expect(actualKeys).toHaveLength(expectedKeys.length);
  });

  it('provides non-empty labels and units', () => {
    for (const definition of measurementTypeDefinitions) {
      expect(definition.label.trim().length).toBeGreaterThan(0);
      expect(definition.unit.trim().length).toBeGreaterThan(0);
    }
  });
});
