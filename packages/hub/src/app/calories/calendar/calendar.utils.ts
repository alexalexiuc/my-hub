import { dateToString } from '@my-hub/shared/utils';

/** The current calendar month as YYYY-MM. */
export function currentMonthStr(): string {
  return dateToString(new Date()).slice(0, 7);
}

/**
 * Where a day sits relative to today — a single value rather than an `isPast`/`isToday` pair of
 * booleans, so "both true" can't be passed in by mistake. Callers derive it once from comparing
 * the day's date against today's.
 */
export type DayRelation = 'past' | 'today' | 'future';

/** A day cell's weekly-menu badge state:
 * - `none` — no menu planned for the day, so no icon shows at all.
 * - `planned` — a menu is planned for a future day; icon alone.
 * - `pending` — a menu is planned for today and isn't fully logged yet; the day still has time
 *   left, so this must never read as "missed" — more meals may still be logged later today.
 * - `logged` — every planned meal for the day has been logged; icon + green check.
 * - `missed` — the day is in the past and something planned was never logged; icon + red x.
 */
export type MenuDayStatus = 'none' | 'planned' | 'pending' | 'logged' | 'missed';

/** Resolves a day cell's menu badge state from the calendar API's per-day menu flags. */
export function menuDayStatus(hasMenu: boolean, logged: boolean, dayRelation: DayRelation): MenuDayStatus {
  if (!hasMenu) return 'none';
  if (logged) return 'logged';
  if (dayRelation === 'past') return 'missed';
  if (dayRelation === 'today') return 'pending';
  return 'planned';
}

/** Semantic color for a menu-day status — shared by the desktop corner badge and the bigger
 * mobile status icon so the two can't drift on which color represents which state. `none` never
 * renders, so it carries no tone. */
export type MenuStatusTone = 'neutral' | 'accent' | 'success' | 'danger';

export function menuStatusTone(status: Exclude<MenuDayStatus, 'none'>): MenuStatusTone {
  if (status === 'logged') return 'success';
  if (status === 'missed') return 'danger';
  if (status === 'pending') return 'accent';
  return 'neutral';
}
