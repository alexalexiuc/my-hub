const PREFIX = 'hub:cache:';

/**
 * Reads and JSON-parses a namespaced localStorage entry, validating it with `isValid`
 * before returning it. Returns `null` on the server, when the key is missing, when the
 * value fails to parse, or when it fails validation (e.g. an old cached shape after a
 * schema change) — callers should treat `null` the same as "no cache yet".
 */
export function readLocalCache<T>(key: string, isValid: (value: unknown) => value is T): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * JSON-stringifies and writes a namespaced localStorage entry. Best-effort: silently
 * no-ops on the server, when storage is disabled, or when the write exceeds quota.
 */
export function writeLocalCache<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // quota exceeded / storage disabled — caching is best-effort
  }
}
