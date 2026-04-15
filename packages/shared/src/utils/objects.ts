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

/**
 * Extract specified environment variables into an object.
 * - `keys` is an array of environment variable names to extract.
 * - If a variable is not set, it will be ignored or cause an error based on `ignoreMissing`.
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
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is required`);
  }
  return value;
}
