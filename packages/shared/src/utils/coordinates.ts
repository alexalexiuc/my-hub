import { z } from 'zod';

const CoordsSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

type Coords = z.infer<typeof CoordsSchema>;

/** Validates that the input is an object with lat/lng properties in valid ranges. */
export function validateCoords(obj: unknown): Coords {
  return CoordsSchema.parse(obj);
}
