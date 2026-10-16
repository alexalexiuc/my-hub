import { describe, expect, it } from 'vitest';
import { formatCompact, formatMoney, formatNumber, formatSigned } from './format';

// Intl separates the amount and the symbol with a no-break space.
const nbsp = ' ';

describe('formatNumber', () => {
  it('defaults to two decimals in de-DE', () => {
    expect(formatNumber(1234.5)).toBe('1.234,50');
    expect(formatNumber(-0.004)).toBe('-0,00');
  });

  it('rounds to whole numbers with decimals: 0', () => {
    expect(formatNumber(1234.5, { decimals: 0 })).toBe('1.235');
    expect(formatNumber(999.4, { decimals: 0 })).toBe('999');
  });

  it('formats en-US with grouping, as the vacation and transaction amounts do', () => {
    expect(formatNumber(1058.82, { decimals: 0, locale: 'en-US' })).toBe('1,059');
    expect(formatNumber(1100.5, { locale: 'en-US' })).toBe('1,100.50');
  });

  it('rounds the shortest decimal form half away from zero, unlike toFixed', () => {
    expect(formatNumber(1.005)).toBe('1,01');
    expect((1.005).toFixed(2)).toBe('1.00');
    expect(formatNumber(1.45, { decimals: 1, locale: 'en-US' })).toBe('1.5');
  });

  it('trims trailing zeros with trimZeros', () => {
    const opts = { trimZeros: true, locale: 'en-US', grouping: false } as const;
    expect(formatNumber(1100.5, opts)).toBe('1100.5');
    expect(formatNumber(1000, opts)).toBe('1000');
    expect(formatNumber(0, opts)).toBe('0');
    expect(formatNumber(12.34, opts)).toBe('12.34');
  });
});

describe('formatSigned', () => {
  const two = (n: number) => n.toFixed(2);

  it('prefixes + and the chosen minus', () => {
    expect(formatSigned(0.5, two)).toBe('+0.50');
    expect(formatSigned(-0.5, two)).toBe('-0.50');
    expect(formatSigned(-441, n => `${n}`, { minus: '−' })).toBe('−441');
  });

  it('prints zero with zeroSign (none by default)', () => {
    expect(formatSigned(0, two)).toBe('0.00');
    expect(formatSigned(-0, two)).toBe('0.00');
    expect(formatSigned(0, two, { zeroSign: '+' })).toBe('+0.00');
  });

  it('keeps the sign of values that round to zero, like toFixed', () => {
    expect(formatSigned(-0.001, two)).toBe('-0.00');
    expect(formatSigned(0.001, two)).toBe('+0.00');
  });
});

describe('formatCompact', () => {
  it('shortens thousands and rounds the rest', () => {
    expect(formatCompact(1058.8)).toBe('1.1k');
    expect(formatCompact(-441.2)).toBe('-441');
    expect(formatCompact(999.6)).toBe('1000');
    expect(formatCompact(12500)).toBe('12.5k');
  });

  it('signs both ways with signed, and never signs zero', () => {
    const opts = { signed: true, minus: '−' };
    expect(formatCompact(1058.8, opts)).toBe('+1.1k');
    expect(formatCompact(-441.2, opts)).toBe('−441');
    expect(formatCompact(0.2, opts)).toBe('0');
    expect(formatCompact(-0.49, opts)).toBe('0');
    expect(formatCompact(0.5, opts)).toBe('+1');
  });
});

describe('formatMoney', () => {
  it('formats de-DE currency with two decimals by default', () => {
    expect(formatMoney(1234.5)).toBe(`1.234,50${nbsp}€`);
    expect(formatMoney(77, 'EUR')).toBe(`77,00${nbsp}€`);
    expect(formatMoney(-12.3, 'USD')).toBe(`-12,30${nbsp}$`);
    expect(formatMoney(6033.03, 'MDL')).toBe(`6.033,03${nbsp}MDL`);
  });

  it('signs every value, zero as +, with signed', () => {
    expect(formatMoney(5, 'EUR', { signed: true })).toBe(`+5,00${nbsp}€`);
    expect(formatMoney(-5, 'EUR', { signed: true })).toBe(`-5,00${nbsp}€`);
    expect(formatMoney(0, 'EUR', { signed: true })).toBe(`+0,00${nbsp}€`);
    expect(formatMoney(-0, 'EUR', { signed: true })).toBe(`+0,00${nbsp}€`);
  });
});
