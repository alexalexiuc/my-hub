/** Checks if the given value is a valid Date object or null */
export function isValidDate(d: unknown): d is Date {
  return d instanceof Date && !isNaN(d.getTime());
}

/**
 * Returns today's date as a YYYY-MM-DD string.
 * When a valid IANA timezone string is supplied the date is resolved in that
 * timezone; otherwise the environment's local time is used (browser local time
 * in client components, server local time on the server-side).
 */
export function localDateString(timezone?: string | null): string {
  if (timezone) {
    try {
      // 'en-CA' locale reliably formats dates as YYYY-MM-DD (ISO 8601)
      return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
    } catch {
      // Invalid timezone — fall through to local time
    }
  }
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Returns the current hour (0–23) in the given IANA timezone, or the
 * environment's local hour when no timezone is provided.
 */
export function localHour(timezone?: string | null): number {
  if (timezone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: timezone,
      }).formatToParts(new Date());
      const h = parts.find((p) => p.type === 'hour');
      if (h) return parseInt(h.value, 10) % 24;
    } catch {
      // Invalid timezone — fall through to local time
    }
  }
  return new Date().getHours();
}
