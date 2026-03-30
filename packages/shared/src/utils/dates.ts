/** Checks if the given value is a valid Date object or null */
export function isValidDate(d: unknown): d is Date {
  return d instanceof Date && !isNaN(d.getTime());
}

/**
 * Formats a Date object as a YYYY-MM-DD string using the environment's local time.
 * Use this wherever a calendar date string is needed from a local Date value.
 */
export function dateToString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Returns true when the string is a UTC offset like "+2", "-5", "+5:30". */
function isOffsetString(s: string): boolean {
  return /^[+-]\d{1,2}(:\d{2})?$/.test(s);
}

/**
 * Parses a UTC offset string like "+2" or "-5:30" into total minutes from UTC.
 * Returns null when the string cannot be parsed.
 */
function offsetToMinutes(offsetStr: string): number | null {
  const match = offsetStr.match(/^([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return null;
  const sign = match[1] === '+' ? 1 : -1;
  const hours = parseInt(match[2]!, 10);
  const mins = parseInt(match[3] ?? '0', 10);
  return sign * (hours * 60 + mins);
}

/**
 * Returns today's date as a YYYY-MM-DD string.
 *
 * Timezone resolution order:
 * 1. UTC offset string ("+2", "-5", "+5:30") — computed directly from UTC epoch.
 * 2. IANA timezone identifier ("Europe/Bucharest") — resolved via Intl.DateTimeFormat.
 * 3. Environment local time (browser local time in client components).
 */
export function localDateString(timezone?: string | null): string {
  if (timezone) {
    if (isOffsetString(timezone)) {
      const offsetMinutes = offsetToMinutes(timezone);
      if (offsetMinutes !== null) {
        // Standard technique: shift the UTC epoch by the offset amount, then read UTC
        // components. Because UTC + offset_ms gives a Date whose UTC components equal
        // the local date/time in the target timezone (no DST adjustments needed for a
        // fixed offset).
        const d = new Date(Date.now() + offsetMinutes * 60000);
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      }
    } else {
      try {
        // 'en-CA' locale reliably formats dates as YYYY-MM-DD (ISO 8601)
        return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
      } catch {
        // Invalid IANA timezone — fall through to local time
      }
    }
  }
  const d = new Date();
  return dateToString(d);
}

/**
 * Returns the current hour (0–23) in the resolved timezone.
 *
 * Timezone resolution order:
 * 1. UTC offset string ("+2", "-5", "+5:30").
 * 2. IANA timezone identifier.
 * 3. Environment local hour.
 */
export function localHour(timezone?: string | null): number {
  if (timezone) {
    if (isOffsetString(timezone)) {
      const offsetMinutes = offsetToMinutes(timezone);
      if (offsetMinutes !== null) {
        // Standard technique: shift the UTC epoch by the offset, then read UTC hours.
        // getUTCHours() on (Date.now() + offset_ms) equals the local hour in the target
        // fixed-offset timezone.
        return new Date(Date.now() + offsetMinutes * 60000).getUTCHours();
      }
    } else {
      try {
        const parts = new Intl.DateTimeFormat('en-US', {
          hour: 'numeric',
          hour12: false,
          timeZone: timezone,
        }).formatToParts(new Date());
        const h = parts.find((p) => p.type === 'hour');
        if (h) return parseInt(h.value, 10) % 24;
      } catch {
        // Invalid IANA timezone — fall through to local time
      }
    }
  }
  return new Date().getHours();
}

/** Returns a new Date shifted by the given number of minutes. */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/** Returns a new Date shifted by the given number of hours. */
export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000);
}
