/**
 * Moldovan public holidays (pure).
 *
 * Exports:
 *   orthodoxEasterDate(year)     — Orthodox Easter Sunday as a Gregorian YYYY-MM-DD (valid 1900–2099)
 *   moldovaPublicHolidays(year)  — Labour Code art. 111 national non-working days for a year, sorted
 *
 * The local hram day and Government day transfers are not derivable and are not included.
 */
import { shiftDateStr } from './dates';

/**
 * Orthodox Easter Sunday for a year: Meeus' Julian computus, then +13 days to convert the Julian
 * date to Gregorian (the offset holds for 1900–2099).
 */
export function orthodoxEasterDate(year: number): string {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  const julian = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return shiftDateStr(julian, 13);
}

/**
 * Labour Code art. 111 non-working holidays: New Year, Orthodox Christmas (7–8 Jan), 8 March,
 * Easter Sunday and Monday, Blajini (the Monday after the following Sunday), 1 May, 9 May,
 * 1 June, 27 and 31 August, 25 December.
 */
export function moldovaPublicHolidays(year: number): { date: string; name: string }[] {
  const easter = orthodoxEasterDate(year);
  const fixed = (md: string, name: string) => ({ date: `${year}-${md}`, name });
  return [
    fixed('01-01', 'New Year'),
    fixed('01-07', 'Orthodox Christmas'),
    fixed('01-08', 'Orthodox Christmas'),
    fixed('03-08', "International Women's Day"),
    { date: easter, name: 'Easter' },
    { date: shiftDateStr(easter, 1), name: 'Easter Monday' },
    { date: shiftDateStr(easter, 8), name: 'Blajini (Memorial Easter)' },
    fixed('05-01', 'Labour Day'),
    fixed('05-09', 'Victory and Europe Day'),
    fixed('06-01', "Children's Day"),
    fixed('08-27', 'Independence Day'),
    fixed('08-31', 'Romanian Language Day'),
    fixed('12-25', 'Christmas'),
  ].sort((x, y) => x.date.localeCompare(y.date));
}
