/**
 * Object utilities
 * - omitUndefined(obj) — shallow copy with `undefined` properties removed (null kept)
 * - omitNullish(obj) — shallow copy with `null` and `undefined` properties removed
 */

/**
 * Return a shallow copy of `obj` with every property whose value is `undefined` removed.
 * `null` values are kept.
 */
export function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<{ [K in keyof T]: T[K] }> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== undefined) result[key] = val;
  }
  return result as Partial<{ [K in keyof T]: T[K] }>;
}

/**
 * Return a shallow copy of `obj` with every property whose value is `null` or
 * `undefined` removed.
 */
export function omitNullish<T extends Record<string, unknown>>(obj: T): Partial<{ [K in keyof T]: NonNullable<T[K]> }> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val != null) result[key] = val;
  }
  return result as Partial<{ [K in keyof T]: NonNullable<T[K]> }>;
}
