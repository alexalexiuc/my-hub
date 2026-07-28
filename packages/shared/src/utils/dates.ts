/**
 * Date utilities
 * - isValidDate(d) — type guard: true if d is a non-NaN Date object
 * - dateToString(d) — format Date as YYYY-MM-DD using local time
 * - currentDateString(timezone?) — explicit alias for localDateString(timezone)
 * - dateStringDaysAgo(daysAgo, timezone?) — YYYY-MM-DD for N calendar days ago in resolved timezone
 * - localDateString(timezone?) — today as YYYY-MM-DD, resolved via UTC offset / IANA / local
 * - localHour(timezone?) — current hour (0-23) in the resolved timezone
 * - toUTCDateStr(d) — format Date as YYYY-MM-DD using UTC components
 * - addDays(d, n) — new Date shifted by n calendar days (UTC arithmetic)
 * - addMinutes(date, minutes) — new Date shifted by n minutes
 * - addHours(date, hours) — new Date shifted by n hours
 * - addMonths(d, n) — shift a UTC month-start date by n months (always 1st of month)
 * - getISOWeek(d) — ISO 8601 week number (week 1 = week containing first Thursday)
 * - getLastMonday(referenceDate?) — start of the previous ISO week at UTC midnight
 * - getLastMonthStart(referenceDate?) — first day of the previous month at UTC midnight
 * - isoWeekAndYear(d) — { week, year } ISO week number and week-year for a UTC date
 * - monthLabel(monthStart) — "Month YYYY" string from a UTC month-start date
 * - shiftMonthStr(month, delta) — shift a YYYY-MM string by delta months, returns YYYY-MM
 * - formatMonthStr(month) — format a YYYY-MM string as "Month YYYY"
 * - weekLabel(weekStart) — "Week W, YYYY" string from an ISO week-start date
 * - calendarDays(startAt, endAt) — array of YYYY-MM-DD strings for each day start→end inclusive
 * - formatDayHeading(dateStr) — YYYY-MM-DD → locale short heading e.g. "Mon, 1 Jan"
 * - fmtDuration(ms) — milliseconds → human-readable duration e.g. "2h 30m" or "45 min"
 * - formatSegmentTime(datetime, timezone, now?) — timezone-aware relative time string + isSoon flag
 * - monthToDateRange(month) — YYYY-MM → { fromDate, toDate } as YYYY-MM-DD strings (UTC-safe)
 * - getMonthStart(date) — first day of the month at local midnight
 * - getMonthEnd(date) — last day of the month at local midnight
 * - startOfWeekMonday(date) — Monday of the week containing date, at local midnight
 * - dayOfWeekMon0(dateStr) — day index for a YYYY-MM-DD string, Monday-first (0=Mon … 6=Sun)
 * - isSameDay(a, b) — true if two dates fall on the same local calendar day
 * - toDate(value) — coerce unknown to Date; returns null on invalid input
 * - startOfDay(date) — copy of date with time set to 00:00:00.000 local
 * - toDateInputValue(value) — format for <input type="date"> as YYYY-MM-DD (local time)
 * - toDateTimeLocalValue(value) — format for <input type="datetime-local"> as YYYY-MM-DDTHH:mm (local time)
 * - getTimezoneNamePart(date, timezone, timeZoneName) — extract timezone name part via Intl
 * - normalizeOffset(offsetLabel) — parse GMT/UTC offset label → ±HH:MM or null
 * - getTimezoneBadge(date, timezone) — { short, offset } display badge for a timezone
 * - getFullDateTooltip(date, timezone) — full locale date+time+timezone string for a tooltip
 * - getCurrentWeekDays() — returns the 7 days of the current ISO week (Mon–Sun) with YYYY-MM-DD strings and short labels
 */
import { dayNamesShort } from '../constants/calendar';

/** Checks if the given value is a valid Date object or null */
export function isValidDate(d: unknown): d is Date {
  return d instanceof Date && !isNaN(d.getTime());
}

type SupportedDateFormat = 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'YYYY-MM';

/**
 * Formats a Date object as a YYYY-MM-DD string using the environment's local time.
 * Use this wherever a calendar date string is needed from a local Date value.
 */
export function dateToString(d: Date = new Date(), format: SupportedDateFormat = 'YYYY-MM-DD'): string {
  const YYYY = String(d.getFullYear()).padStart(4, '0');
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const DD = String(d.getDate()).padStart(2, '0');
  return format.replace('YYYY', YYYY).replace('MM', MM).replace('DD', DD);
}

/** Returns today's date string (YYYY-MM-DD) in the provided timezone. */
export function currentDateString(timezone?: string | null): string {
  return localDateString(timezone);
}

/** Returns the date string for N calendar days ago in the provided timezone. */
export function dateStringDaysAgo(daysAgo: number, timezone?: string | null): string {
  const [year, month, day] = currentDateString(timezone).split('-').map(Number) as [number, number, number];
  return toUTCDateStr(addDays(new Date(Date.UTC(year, month - 1, day)), -daysAgo));
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
        // components. Because UTC + offsetMs gives a Date whose UTC components equal
        // the local date/time in the target timezone (no DST adjustments needed for a
        // fixed offset).
        return toUTCDateStr(new Date(Date.now() + offsetMinutes * 60000));
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
 * Returns the current hour (0-23) in the resolved timezone.
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
        // getUTCHours() on (Date.now() + offsetMs) equals the local hour in the target
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
        const h = parts.find(p => p.type === 'hour');
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
  return isoWeekAndYear(d).week;
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

/** Parses a YYYY-MM string to a UTC Date at the first of that month. */
function parseMonthStr(month: string): Date {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, 1));
}

/**
 * Shifts a YYYY-MM string by delta months and returns a new YYYY-MM string.
 * e.g. shiftMonthStr('2026-01', -1) → '2025-12'
 */
export function shiftMonthStr(month: string, delta: number): string {
  const d = addMonths(parseMonthStr(month), delta);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Formats a YYYY-MM string as "Month YYYY", e.g. '2026-05' → 'May 2026'. */
export function formatMonthStr(month: string): string {
  return monthLabel(parseMonthStr(month));
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

/**
 * Formats a YYYY-MM-DD date string as a short locale heading, e.g. "Mon, 1 Jan".
 * The date is interpreted as a local (wall-clock) date with no timezone conversion.
 */
export function formatDayHeading(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * Formats a duration given in milliseconds as a human-readable string.
 * Examples: 2700000 → "45 min", 7200000 → "2h", 9000000 → "2h 30m".
 */
export function fmtDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * Formats a datetime ISO string as a timezone-aware relative time string.
 * Returns `{ text, isSoon }` where `isSoon` is true when the event is within 3 hours in the future.
 * The `timezone` parameter is an IANA timezone string; pass null to fall back to UTC.
 * Falls back to an absolute date+time string for past events and events more than 24 hours away.
 */
export function formatSegmentTime(
  datetime: string,
  timezone: string | null,
  now: Date = new Date(),
): { text: string; isSoon: boolean } {
  const target = new Date(datetime);
  const diffMs = target.getTime() - now.getTime();
  const THREE_HOURS = 3 * 60 * 60 * 1000;
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  const isSoon = diffMs > 0 && diffMs <= THREE_HOURS;

  const tz = timezone ?? 'UTC';
  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: tz,
  });
  const dateFormatter = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: tz,
  });

  const timeStr = timeFormatter.format(target);

  if (diffMs < 0) {
    return { text: `${dateFormatter.format(target)} · ${timeStr}`, isSoon: false };
  }

  // Check if target is tomorrow in the given timezone
  const tzFmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz });
  const tomorrowDateStr = tzFmt.format(addDays(now, 1));

  if (tzFmt.format(target) === tomorrowDateStr) {
    return { text: `Tomorrow · ${timeStr}`, isSoon: false };
  }

  if (diffMs <= TWENTY_FOUR_HOURS) {
    const totalMinutes = Math.round(diffMs / 60000);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0) return { text: `In ${m} min`, isSoon };
    return { text: `In ${h} h ${m} min`, isSoon };
  }

  return { text: `${dateFormatter.format(target)} · ${timeStr}`, isSoon: false };
}

/**
 * Converts a YYYY-MM month string to a { fromDate, toDate } date range (both YYYY-MM-DD).
 * Computed in UTC so server timezone does not affect the result.
 */
export function monthToDateRange(month: string): { fromDate: string; toDate: string } {
  const [y, m] = month.split('-').map(Number);
  return {
    fromDate: `${month}-01`,
    toDate: toUTCDateStr(new Date(Date.UTC(y!, m!, 0))),
  };
}

// TODO: These functions use local-time methods (getFullYear, getMonth) and are unsafe when the
// input Date was parsed from a UTC date string (e.g. new Date("2024-01-01")). Audit callers and
// consider adding UTC-based variants or making these UTC-safe internally.

/** Returns a new Date set to the first day of the month containing `date`, at local midnight. */
export function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Returns a new Date set to the last day of the month containing `date`, at local midnight. */
export function getMonthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/**
 * Returns the Monday that starts the ISO week containing `date`, at local midnight.
 * If `date` is a Sunday it steps back 6 days.
 */
export function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Day-of-week index for a YYYY-MM-DD string in the Monday-first convention this codebase uses
 * everywhere (0=Mon … 6=Sun) — as opposed to `Date.getDay()`, which is Sunday-first. Parsed at
 * local midnight so the index matches the calendar day the string names, not UTC's.
 *
 * Exists so the Sun=0 → Mon=0 correction lives in one place: it was being re-derived inline at
 * every call site, each with its own comment explaining the `+ 6) % 7`.
 */
export function dayOfWeekMon0(dateStr: string): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return ((new Date(`${dateStr}T00:00:00`).getDay() + 6) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

/** Returns true if `a` and `b` fall on the same local calendar day (year + month + date). */
export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Coerces an unknown value to a Date.
 * Returns null if the value is falsy or results in an invalid date.
 */
export function toDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Returns a copy of `date` with the local time set to 00:00:00.000. */
export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function localISOValue(value: Date | string | null | undefined, length: 10 | 16): string {
  if (!value) return '';
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, length);
}

/**
 * Formats a date value as a YYYY-MM-DD string suitable for `<input type="date">`.
 * Uses local time (adjusted for the environment's UTC offset). Returns '' for invalid input.
 */
export function toDateInputValue(value: Date | string | null | undefined): string {
  return localISOValue(value, 10);
}

/**
 * Formats a date value as a YYYY-MM-DDTHH:mm string suitable for `<input type="datetime-local">`.
 * Uses local time (adjusted for the environment's UTC offset). Returns '' for invalid input.
 */
export function toDateTimeLocalValue(value: Date | string | null | undefined): string {
  return localISOValue(value, 16);
}

/**
 * Extracts a timezone name part (e.g. 'short', 'shortOffset', 'long') from a date using Intl.
 * Returns an empty string if the timezone is invalid or the part is unavailable.
 */
export function getTimezoneNamePart(
  date: Date,
  timezone: string,
  timeZoneName: 'short' | 'shortOffset' | 'long',
): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
      timeZoneName,
    }).formatToParts(date);
    return parts.find(item => item.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}

/**
 * Normalises a raw timezone offset label (e.g. "GMT+2", "UTC-05:30") to ±HH:MM format.
 * Returns null if the label cannot be parsed, or '+00:00' for UTC/empty labels.
 */
export function normalizeOffset(offsetLabel: string): string | null {
  const cleaned = offsetLabel.trim().replace(/^GMT/i, '').replace(/^UTC/i, '');
  if (!cleaned) return '+00:00';
  const match = cleaned.match(/^([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return null;
  const [, sign = '+', hours = '0', minutes = '00'] = match;
  const hh = hours.padStart(2, '0');
  const mm = minutes.padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

/**
 * Derives display badge info for a timezone: a short name (e.g. "EEST") and a ±HH:MM offset.
 * Pass `null` for `timezone` to represent UTC explicitly.
 */
export function getTimezoneBadge(date: Date, timezone: string | null): { short: string; offset: string | null } {
  if (timezone === null) {
    return { short: 'UTC', offset: '+00:00' };
  }
  const shortName = getTimezoneNamePart(date, timezone, 'short');
  const offsetRaw = getTimezoneNamePart(date, timezone, 'shortOffset');
  const offset = normalizeOffset(offsetRaw);
  return { short: shortName || timezone, offset };
}

/**
 * Returns the 7 days of the current ISO week (Mon–Sun) as YYYY-MM-DD strings with short labels.
 * The current day is labelled "Today"; all other days use short weekday names (Mon, Tue…).
 */
export function getCurrentWeekDays(): { date: string; label: string }[] {
  const days: { date: string; label: string }[] = [];
  const today = new Date();
  const daysSinceMonday = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysSinceMonday);
  const cursor = new Date(monday);
  for (let i = 0; i < 7; i += 1) {
    days.push({
      date: dateToString(cursor),
      label: cursor.toDateString() === today.toDateString() ? 'Today' : dayNamesShort[(cursor.getDay() + 6) % 7]!,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/**
 * Returns a full locale date+time+timezone string for use as a tooltip.
 * Falls back to the ISO string if the timezone is invalid.
 */
export function getFullDateTooltip(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
      timeZoneName: 'long',
    }).format(date);
  } catch {
    return date.toISOString();
  }
}
