import { describe, expect, it } from 'vitest';
import { parseAndValidateDate, parseAndValidateDateForPatch } from './date-validation';

describe('parseAndValidateDate', () => {
  it('returns null when value is not a string', () => {
    expect(parseAndValidateDate(undefined, 'startAt')).toEqual({ date: null });
    expect(parseAndValidateDate(null, 'startAt')).toEqual({ date: null });
    expect(parseAndValidateDate(123, 'startAt')).toEqual({ date: null });
  });

  it('returns parsed Date when value is a valid datetime string', () => {
    const result = parseAndValidateDate('2026-03-23T12:30:00.000Z', 'startAt');

    expect(result.error).toBeUndefined();
    expect(result.date).toBeInstanceOf(Date);
    expect(result.date?.toISOString()).toBe('2026-03-23T12:30:00.000Z');
  });

  it('returns error when value is an invalid datetime string', () => {
    const result = parseAndValidateDate('not-a-date', 'startAt');

    expect(result.date).toBeNull();
    expect(result.error).toBe('startAt must be a valid datetime string');
  });
});

describe('parseAndValidateDateForPatch', () => {
  it('returns undefined when value is not provided', () => {
    expect(parseAndValidateDateForPatch(undefined, 'endAt')).toEqual({ date: undefined });
    expect(parseAndValidateDateForPatch(123, 'endAt')).toEqual({ date: undefined });
  });

  it('returns null when value is null or empty string', () => {
    expect(parseAndValidateDateForPatch(null, 'endAt')).toEqual({ date: null });
    expect(parseAndValidateDateForPatch('', 'endAt')).toEqual({ date: null });
  });

  it('returns parsed Date when value is a valid datetime string', () => {
    const result = parseAndValidateDateForPatch('2026-03-24T08:15:00.000Z', 'endAt');

    expect(result.error).toBeUndefined();
    expect(result.date).toBeInstanceOf(Date);
    expect(result.date?.toISOString()).toBe('2026-03-24T08:15:00.000Z');
  });

  it('returns error when value is an invalid datetime string', () => {
    const result = parseAndValidateDateForPatch('invalid-date', 'endAt');

    expect(result.date).toBeUndefined();
    expect(result.error).toBe('endAt must be a valid datetime string');
  });
});
