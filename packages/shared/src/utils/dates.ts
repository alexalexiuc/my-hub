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

/**
 * Formats a UTC Date as a YYYY-MM-DD string using UTC components.
 * Use this wherever a calendar date in UTC is needed (e.g. report date ranges).
 */
export function toUTCDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Returns a new Date shifted by n calendar days using UTC date arithmetic. */
export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

/**
 * Returns the ISO 8601 week number for the given date (week starts on Monday).
 * Week 1 is the week containing the first Thursday of the year.
 */
export function getISOWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayOfWeek = date.getUTCDay() || 7; // Sun=0 → 7, Mon=1 … Sat=6
  date.setUTCDate(date.getUTCDate() + 4 - dayOfWeek); // Thursday of current week
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Returns the start of the previous month at UTC midnight. */
export function getLastMonthStart(referenceDate: Date = new Date()): Date {
  return new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() - 1, 1));
}

/**
 * Shifts a UTC month-start date by n months and returns the resulting month start.
 * The returned date is always the first day of month at UTC midnight.
 */
export function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

/** Formats a UTC month-start date as "Month YYYY" in English. */
export function monthLabel(monthStart: Date): string {
  return monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Returns the start (Monday) of the previous ISO week at UTC midnight. */
export function getLastMonday(referenceDate: Date = new Date()): Date {
  const todayUtc = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate()),
  );
  const dayOfWeek = todayUtc.getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  todayUtc.setUTCDate(todayUtc.getUTCDate() - daysSinceMonday - 7);
  return todayUtc;
}

/** Returns ISO week number and ISO week-year for a UTC date. */
export function isoWeekAndYear(d: Date): { week: number; year: number } {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week, year: date.getUTCFullYear() };
}

/** Formats an ISO week start date as "Week W, YYYY". */
export function weekLabel(weekStart: Date): string {
  const { week, year } = isoWeekAndYear(weekStart);
  return `Week ${week}, ${year}`;
}

/** Returns a new Date shifted by the given number of minutes. */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/** Returns a new Date shifted by the given number of hours. */
export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000);
}

/** Formats a Date as a YYYY-MM-DD string using local time components. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Returns an array of YYYY-MM-DD strings for each calendar day from start to end (inclusive). */
export function calendarDays(startAt: Date, endAt: Date): string[] {
  const days: string[] = [];
  const cur = new Date(startAt);
  cur.setUTCHours(0, 0, 0, 0);
  const end = new Date(endAt);
  end.setUTCHours(0, 0, 0, 0);
  while (cur <= end) {
    days.push(toUTCDateStr(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}
