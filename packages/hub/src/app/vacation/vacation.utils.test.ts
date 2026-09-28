import { describe, expect, it } from 'vitest';
import {
  blankToNull,
  coversDate,
  deltaTextClass,
  formatDays,
  formatDeltaCompact,
  formatRate,
  formatSignedMdl,
  isInRange,
  leaveCovering,
  leaveDelta,
  normalizeRange,
  parseOptionalNumber,
  spanDays,
} from './vacation.utils';
import type { VacationLeaveEstimate } from '@my-hub/shared/services';

describe('vacation utils', () => {
  it('orders a dragged range regardless of direction', () => {
    expect(normalizeRange('2026-05-10', '2026-05-04')).toEqual(['2026-05-04', '2026-05-10']);
    expect(isInRange('2026-05-06', ['2026-05-04', '2026-05-10'])).toBe(true);
    expect(isInRange('2026-05-11', ['2026-05-04', '2026-05-10'])).toBe(false);
    expect(isInRange('2026-05-11', null)).toBe(false);
  });

  it('formats compact and signed amounts', () => {
    expect(formatDeltaCompact(1058.8)).toBe('+1.1k');
    expect(formatDeltaCompact(-441.2)).toBe('−441');
    expect(formatDeltaCompact(0.2)).toBe('0');
    expect(formatSignedMdl(-1147.06)).toBe('−1,147 MDL');
    expect(formatSignedMdl(0.3)).toBe('0 MDL');
    expect(formatDays(1)).toBe('1 day');
    expect(formatDays(6.5)).toBe('6.5 days');
  });

  it('colours gains green, losses red and leaves zero days plain', () => {
    expect(deltaTextClass(0.2)).toBeUndefined();
    expect(deltaTextClass(1000)).toBe('text-[var(--green)]');
    expect(deltaTextClass(-200)).toBe('text-[var(--red)]');
  });

  it('turns blank form text into null and keeps trimmed text', () => {
    expect(blankToNull('   ')).toBeNull();
    expect(blankToNull(' Chisinau ')).toBe('Chisinau');
  });

  it('parses optional numbers, rejecting blanks and garbage', () => {
    expect(parseOptionalNumber('')).toBeNull();
    expect(parseOptionalNumber('abc')).toBeNull();
    expect(parseOptionalNumber('12.5')).toBe(12.5);
    expect(parseOptionalNumber('0')).toBe(0);
  });

  it('counts a leave span inclusively, across a DST change', () => {
    expect(spanDays('2026-05-04', '2026-05-10')).toBe(7);
    expect(spanDays('2026-03-28', '2026-03-30')).toBe(3);
    expect(spanDays('2026-05-04', '2026-05-04')).toBe(1);
  });

  it('finds the leave covering a date', () => {
    const leave = [
      { id: 1, startDate: '2026-10-02', endDate: '2026-10-04' },
      { id: 2, startDate: '2026-11-24', endDate: '2026-11-29' },
    ];
    expect(leaveCovering(leave, '2026-10-03')?.id).toBe(1);
    expect(leaveCovering(leave, '2026-11-29')?.id).toBe(2);
    expect(leaveCovering(leave, '2026-10-05')).toBeUndefined();
  });

  it('uses the pay actually received for the delta when recorded', () => {
    const base = {
      payReceivedMdl: null,
      estimate: { amountNet: 10_000, deltaNet: 4_000 },
    } as unknown as VacationLeaveEstimate;
    expect(leaveDelta(base)).toEqual({ value: 4_000, actual: false });
    expect(leaveDelta({ ...base, payReceivedMdl: 9_000 })).toEqual({ value: 3_000, actual: true });
    expect(leaveDelta({ ...base, estimate: null })).toBeNull();
  });

  it('checks a dated rule against a date, open-ended or not', () => {
    expect(coversDate({ validFrom: '2027-01-01', validTo: null }, '2026-12-31')).toBe(false);
    expect(coversDate({ validFrom: '2027-01-01', validTo: null }, '2030-05-01')).toBe(true);
    expect(coversDate({ validFrom: '2026-01-01', validTo: '2026-10-31' }, '2026-11-01')).toBe(false);
  });

  it('formats a rate as a percentage', () => {
    expect(formatRate(0.12)).toBe('12%');
    expect(formatRate(0.09)).toBe('9%');
    expect(formatRate(0)).toBe('0%');
  });
});
