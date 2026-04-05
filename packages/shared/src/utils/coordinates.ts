import { z } from 'zod';

const CoordsSchema = z
  .object({
    lat: z.number().min(-90).max(90).nullish(),
    lng: z.number().min(-180).max(180).nullish(),
  })
  .refine((data) => (data.lat == null) === (data.lng == null), {
    message: 'lat and lng must both be provided or both be absent',
  });

type Coords = z.infer<typeof CoordsSchema>;

/**
 * Validates that the input is an object with optional lat/lng properties in valid ranges.
 * If both lat and lng are null/undefined, the coordinates are considered absent (valid).
 * If both are provided, they must be within valid ranges (lat: [-90, 90], lng: [-180, 180]).
 * Throws a ZodError if only one coordinate is provided, or if values are out of range.
 */
export function validateCoords(obj: unknown): Coords {
  return CoordsSchema.parse(obj);
}
