import { calendarDays, dayOfWeekMon0, dateToString } from '@my-hub/shared/utils';
import { shiftDate } from '../calories.utils';

export interface MonthGridDay {
  date: string;
  /** False for the leading/trailing days borrowed from the adjacent month to fill the grid. */
  inMonth: boolean;
}

/** The current calendar month as YYYY-MM. */
export function currentMonthStr(): string {
  return dateToString(new Date()).slice(0, 7);
}

/**
 * Full weeks of YYYY-MM-DD strings covering `month` (YYYY-MM), padded with the trailing days of
 * the surrounding months so the grid always starts on a Monday and ends on a Sunday — a fixed
 * 7-column week layout only works if every row is a complete week.
 */
export function buildMonthGridDays(month: string): MonthGridDay[] {
  const firstOfMonth = `${month}-01`;
  const [year, monthNum] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year ?? 2000, monthNum ?? 1, 0)).getUTCDate();
  const lastOfMonth = `${month}-${String(lastDay).padStart(2, '0')}`;

  const leadingPad = dayOfWeekMon0(firstOfMonth);
  const trailingPad = 6 - dayOfWeekMon0(lastOfMonth);
  const gridStart = shiftDate(firstOfMonth, -leadingPad);
  const gridEnd = shiftDate(lastOfMonth, trailingPad);

  return calendarDays(new Date(`${gridStart}T00:00:00Z`), new Date(`${gridEnd}T00:00:00Z`)).map(date => ({
    date,
    inMonth: date >= firstOfMonth && date <= lastOfMonth,
  }));
}

/**
 * A day cell's weekly-menu badge state:
 * - `none` — no menu planned for the day, so no icon shows at all.
 * - `planned` — a menu is planned for a future day; icon alone.
 * - `pending` — a menu is planned for today and isn't fully logged yet; the day still has time
 *   left, so this must never read as "missed" — more meals may still be logged later today.
 * - `logged` — every planned meal for the day has been logged; icon + green check.
 * - `missed` — the day is in the past and something planned was never logged; icon + red x.
 */
export type MenuDayStatus = 'none' | 'planned' | 'pending' | 'logged' | 'missed';

/** Resolves a day cell's menu badge state from the calendar API's per-day menu flags. */
export function menuDayStatus(hasMenu: boolean, logged: boolean, isPast: boolean, isToday: boolean): MenuDayStatus {
  if (!hasMenu) return 'none';
  if (logged) return 'logged';
  if (isPast) return 'missed';
  if (isToday) return 'pending';
  return 'planned';
}
