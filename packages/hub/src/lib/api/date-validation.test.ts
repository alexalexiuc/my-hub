import { describe, expect, it } from 'vitest';
import { parseAndValidateDate, parseAndValidateDateForPatch } from './date-validation';

describe('parseAndValidateDate', () => {
  it('returns null when value is not a string', () => {
    expect(parseAndValidateDate(undefined, 'start_at')).toEqual({ date: null });
    expect(parseAndValidateDate(null, 'start_at')).toEqual({ date: null });
    expect(parseAndValidateDate(123, 'start_at')).toEqual({ date: null });
  });

  it('returns parsed Date when value is a valid datetime string', () => {
    const result = parseAndValidateDate('2026-03-23T12:30:00.000Z', 'start_at');

    expect(result.error).toBeUndefined();
    expect(result.date).toBeInstanceOf(Date);
    expect(result.date?.toISOString()).toBe('2026-03-23T12:30:00.000Z');
  });

  it('returns error when value is an invalid datetime string', () => {
    const result = parseAndValidateDate('not-a-date', 'start_at');

    expect(result.date).toBeNull();
    expect(result.error).toBe('start_at must be a valid datetime string');
  });
});

describe('parseAndValidateDateForPatch', () => {
  it('returns undefined when value is not provided', () => {
    expect(parseAndValidateDateForPatch(undefined, 'end_at')).toEqual({ date: undefined });
    expect(parseAndValidateDateForPatch(123, 'end_at')).toEqual({ date: undefined });
  });

  it('returns null when value is null or empty string', () => {
    expect(parseAndValidateDateForPatch(null, 'end_at')).toEqual({ date: null });
    expect(parseAndValidateDateForPatch('', 'end_at')).toEqual({ date: null });
  });

  it('returns parsed Date when value is a valid datetime string', () => {
    const result = parseAndValidateDateForPatch('2026-03-24T08:15:00.000Z', 'end_at');

    expect(result.error).toBeUndefined();
    expect(result.date).toBeInstanceOf(Date);
    expect(result.date?.toISOString()).toBe('2026-03-24T08:15:00.000Z');
  });

  it('returns error when value is an invalid datetime string', () => {
    const result = parseAndValidateDateForPatch('invalid-date', 'end_at');

    expect(result.date).toBeUndefined();
    expect(result.error).toBe('end_at must be a valid datetime string');
  });
});
