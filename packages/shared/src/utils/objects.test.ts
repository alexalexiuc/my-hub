import { describe, expect, it } from 'vitest';
import { omitNullish, omitUndefined, extractEnvVars, getEnvVar } from './objects';

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

describe('extractEnvVars', () => {
  it('extracts specified environment variables', () => {
    process.env.TEST_VAR1 = 'value1';
    process.env.TEST_VAR2 = 'value2';
    const result = extractEnvVars(['TEST_VAR1', 'TEST_VAR2']);
    expect(result).toEqual({ TEST_VAR1: 'value1', TEST_VAR2: 'value2' });
  });

  it('ignores missing variables when ignoreMissing is true', () => {
    delete process.env.TEST_VAR3;
    const result = extractEnvVars(['TEST_VAR3'], true);
    expect(result).toEqual({ TEST_VAR3: '' });
  });

  it('throws an error for missing variables when ignoreMissing is false', () => {
    delete process.env.TEST_VAR4;
    expect(() => extractEnvVars(['TEST_VAR4'])).toThrow('Missing environment variables: TEST_VAR4');
  });

  it('returns an empty object when no keys are provided', () => {
    const result = extractEnvVars([]);
    expect(result).toEqual({});
  });

  it('only extracts specified keys', () => {
    process.env.TEST_VAR5 = 'value5';
    process.env.TEST_VAR6 = 'value6';
    const result = extractEnvVars(['TEST_VAR5']);
    expect(result).toEqual({ TEST_VAR5: 'value5' });
  });
});

describe('getEnvVar', () => {
  it('returns the value of an existing environment variable', () => {
    process.env.TEST_VAR7 = 'value7';
    expect(getEnvVar('TEST_VAR7')).toBe('value7');
  });

  it('returns the default value if the environment variable is not set', () => {
    delete process.env.TEST_VAR8;
    expect(getEnvVar('TEST_VAR8', 'default')).toBe('default');
  });

  it('throws an error if the environment variable is not set and no default value is provided', () => {
    delete process.env.TEST_VAR9;
    expect(() => getEnvVar('TEST_VAR9')).toThrow('Environment variable TEST_VAR9 is required');
  });
});
