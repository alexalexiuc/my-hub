/**
 * Array helpers.
 *
 * Named exports:
 * - `dedupeTrimmed(values, seen?)` — trim, drop blanks, and drop case-insensitive duplicates, keeping first occurrence
 */

/**
 * Trim each value, drop blanks, and drop case-insensitive duplicates, keeping the
 * first occurrence of each. The returned strings keep their original casing.
 *
 * Pass `seen` to exclude values that are already known (e.g. rows already in the DB);
 * the set is mutated with every value that is kept, so callers can reuse it across calls.
 *
 * @param values Raw strings to normalise.
 * @param seen Lower-cased values to treat as already taken. Defaults to an empty set.
 * @returns The kept values, in input order.
 */
export function dedupeTrimmed(values: string[], seen: Set<string> = new Set()): string[] {
  const kept: string[] = [];

  for (const raw of values) {
    const text = raw.trim();
    const lower = text.toLowerCase();
    if (!text || seen.has(lower)) continue;
    seen.add(lower);
    kept.push(text);
  }

  return kept;
}
