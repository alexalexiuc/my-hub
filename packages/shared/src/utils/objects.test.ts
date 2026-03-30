import { describe, expect, it } from 'vitest';
import { omitNullish, omitUndefined } from './objects';

describe('omitNullish', () => {
  it('removes null values', () => {
    expect(omitNullish({ a: 1, b: null })).toEqual({ a: 1 });
  });

  it('removes undefined values', () => {
    expect(omitNullish({ a: 1, b: undefined })).toEqual({ a: 1 });
  });

  it('removes both null and undefined', () => {
    expect(omitNullish({ a: null, b: undefined, c: 'keep' })).toEqual({ c: 'keep' });
  });

  it('keeps falsy but non-nullish values', () => {
    expect(omitNullish({ a: 0, b: false, c: '' })).toEqual({ a: 0, b: false, c: '' });
  });

  it('returns a shallow copy, not the original object', () => {
    const input = { a: 1 };
    const output = omitNullish(input);
    expect(output).not.toBe(input);
  });

  it('returns an empty object when all values are nullish', () => {
    expect(omitNullish({ a: null, b: undefined })).toEqual({});
  });

  it('returns an empty object for an empty input', () => {
    expect(omitNullish({})).toEqual({});
  });

  it('does not deep-clone nested objects', () => {
    const nested = { x: 1 };
    const result = omitNullish({ a: nested });
    expect(result.a).toBe(nested);
  });
});

describe('omitUndefined', () => {
  it('removes undefined values', () => {
    expect(omitUndefined({ a: 1, b: undefined })).toEqual({ a: 1 });
  });

  it('keeps null values', () => {
    expect(omitUndefined({ a: 1, b: null })).toEqual({ a: 1, b: null });
  });

  it('keeps falsy but non-undefined values', () => {
    expect(omitUndefined({ a: 0, b: false, c: '', d: null })).toEqual({ a: 0, b: false, c: '', d: null });
  });

  it('returns a shallow copy, not the original object', () => {
    const input = { a: 1 };
    const output = omitUndefined(input);
    expect(output).not.toBe(input);
  });

  it('returns an empty object when all values are undefined', () => {
    expect(omitUndefined({ a: undefined, b: undefined })).toEqual({});
  });

  it('returns an empty object for an empty input', () => {
    expect(omitUndefined({})).toEqual({});
  });

  it('does not deep-clone nested objects', () => {
    const nested = { x: 1 };
    const result = omitUndefined({ a: nested });
    expect(result.a).toBe(nested);
  });
});
