/**
 * Object utilities
 * - omitUndefined(obj) — shallow copy with `undefined` properties removed (null kept)
 * - omitNullish(obj) — shallow copy with `null` and `undefined` properties removed
 * - trimOrNull(val) — trim a string and return null for empty; pass-through undefined as undefined
 * - extractEnvVars(keys, ignoreMissing) — extract specified env vars into an object, with optional missing key handling
 * - getEnvVar(key, defaultValue) — get an env var with optional default and error handling
 * - arrayfy(val) — ensure the value is an array, wrapping in an array if it's not already
 * - deepMergePatch(base, patch) — deep-merge a partial patch into a JSON object; `null` in the patch deletes a key
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
 * Trim a string value and return null when the result is empty.
 * Returns undefined unchanged so the result is safe to pass to omitUndefined.
 */
export function trimOrNull(val: string | null | undefined): string | null | undefined {
  if (val === undefined) return undefined;
  if (val === null) return null;
  return val.trim() || null;
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

/**
 * Extract specified environment variables into an object.
 * - `keys` is an array of environment variable names to extract.
 * - If a variable is not set, it will be defaulted to an empty string or cause an error based on `ignoreMissing`.
 */
export function extractEnvVars<const K extends readonly string[] = readonly string[]>(
  keys: K,
  ignoreMissing = false,
): { [P in K[number]]: string } {
  const result = {} as { [P in K[number]]: string };
  const obj = process.env;
  const missingKeys: string[] = [];
  for (const key of keys) {
    if (key in obj) {
      result[key as K[number]] = obj[key]!;
    } else if (!ignoreMissing) {
      missingKeys.push(key);
    } else {
      // If ignoring missing keys, assign an empty string
      result[key as K[number]] = '';
    }
  }
  if (missingKeys.length > 0) {
    throw new Error(`Missing environment variables: ${missingKeys.join(', ')}`);
  }
  return result;
}

/**
 * Get an environment variable by key, with an optional default value.
 * If the variable is not set and no default value is provided, an error is thrown.
 */
export function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined || value === '') {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is required`);
  }
  return value;
}

/**
 * Ensure the input is an array. If it's already an array, return it as-is; if it's a single value, wrap it in an array.
 */
export function arrayfy<T>(val: T | T[]): T[] {
  return Array.isArray(val) ? val : [val];
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/**
 * Deep-merge `patch` into `base` (JSON-style objects, e.g. a JSONB column) and return a new object.
 * - nested plain objects are merged key by key;
 * - arrays and primitives in the patch replace the base value;
 * - a `null` value in the patch removes that key; `undefined` leaves it unchanged.
 * Neither input is mutated.
 */
export function deepMergePatch(
  base: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...(base ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (value === null) {
      delete result[key];
    } else if (isPlainObject(value)) {
      const current = result[key];
      result[key] = deepMergePatch(isPlainObject(current) ? current : {}, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
