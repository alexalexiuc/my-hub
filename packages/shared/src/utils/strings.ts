/**
 * String utilities
 * - fuzzyMatch(haystack, needle) — subsequence fuzzy match; characters must appear in order but need not be adjacent
 */

/**
 * Returns true if every character of `needle` appears in `haystack` in order (case-insensitive).
 * An empty needle always matches. Useful for real-time search filtering.
 */
export function fuzzyMatch(haystack: string, needle: string): boolean {
  if (!needle) return true;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  let hi = 0;
  for (const ch of n) {
    const found = h.indexOf(ch, hi);
    if (found === -1) return false;
    hi = found + 1;
  }
  return true;
}
