/**
 * Geographic coordinate utilities
 * - validateCoords(obj) — validates lat/lng ranges via Zod; requires both-or-neither; throws ZodError on invalid input
 * - isFiniteCoordinate(value) — type guard: true if value is a finite number
 * - hasValidLatLng(lat, lng) — true if both lat ([-90,90]) and lng ([-180,180]) are finite numbers
 * - parseCoordinatePair(value) — parses "lat, lng" string → { lat, lng } or null
 * - parseGeoUri(value) — parses "geo:lat,lng" URI → { lat, lng } or null
 * - containsPlusCode(value) — true if the string contains an Open Location Code / Plus Code
 */

import { z } from 'zod';

const CoordsSchema = z
  .object({
    lat: z.number().min(-90).max(90).nullish(),
    lng: z.number().min(-180).max(180).nullish(),
  })
  .refine(data => (data.lat == null) === (data.lng == null), {
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

/** Type guard: returns true if value is a finite number (excludes NaN, Infinity, non-numbers). */
export function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Returns true if both lat and lng are finite numbers within valid geographic ranges.
 * lat must be in [-90, 90] and lng must be in [-180, 180].
 */
export function hasValidLatLng(lat: unknown, lng: unknown): lat is number {
  return isFiniteCoordinate(lat) && isFiniteCoordinate(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Parses a "lat, lng" string (e.g. "47.0105, 28.8638") into a coordinate object.
 * Returns null if the string does not match the expected format or coordinates are out of range.
 */
export function parseCoordinatePair(value: string): { lat: number; lng: number } | null {
  const match = value.match(/^\s*([-+]?\d+(?:\.\d+)?)\s*,\s*([-+]?\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!hasValidLatLng(lat, lng)) return null;
  return { lat, lng };
}

/**
 * Parses a geo URI (e.g. "geo:47.0105,28.8638" or "geo:47.0105,28.8638?q=...") into a coordinate object.
 * Returns null if the string is not a valid geo URI or coordinates are out of range.
 */
export function parseGeoUri(value: string): { lat: number; lng: number } | null {
  const match = value.match(/^geo:([-+]?\d+(?:\.\d+)?),([-+]?\d+(?:\.\d+)?)(?:[;?].*)?$/i);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!hasValidLatLng(lat, lng)) return null;
  return { lat, lng };
}

/**
 * Returns true if the string contains an Open Location Code (Plus Code), e.g. "8FVC9G8F+5W" or "2RFP+WM Chisinau".
 * Uses the standard Plus Code alphabet and format pattern.
 */
export function containsPlusCode(value: string): boolean {
  return /\b[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{2,3}\b/i.test(value);
}
