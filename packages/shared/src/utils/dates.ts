/** Checks if the given value is a valid Date object or null */
export function isValidDate(d: unknown): d is Date {
  return d instanceof Date && !isNaN(d.getTime());
}
