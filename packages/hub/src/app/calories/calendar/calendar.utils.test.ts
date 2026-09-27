import { describe, expect, it } from 'vitest';
import { menuDayStatus } from './calendar.utils';

describe('menuDayStatus', () => {
  it('is "none" when no menu is planned, regardless of logged/day relation', () => {
    expect(menuDayStatus(false, false, 'future')).toBe('none');
    expect(menuDayStatus(false, true, 'past')).toBe('none');
  });

  it('is "logged" when the day has a menu and it has all been logged', () => {
    expect(menuDayStatus(true, true, 'future')).toBe('logged');
    expect(menuDayStatus(true, true, 'past')).toBe('logged');
    expect(menuDayStatus(true, true, 'today')).toBe('logged');
  });

  it('is "missed" when the day has passed with something planned left unlogged', () => {
    expect(menuDayStatus(true, false, 'past')).toBe('missed');
  });

  it('is "pending" — never "missed" — for an unlogged menu on today, since the day isn\'t over', () => {
    expect(menuDayStatus(true, false, 'today')).toBe('pending');
  });

  it('is "planned" for an unlogged menu on a future day', () => {
    expect(menuDayStatus(true, false, 'future')).toBe('planned');
  });
});
