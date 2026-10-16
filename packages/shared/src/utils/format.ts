/**
 * Number and money display formatters shared by the Hub features.
 *
 * @exports formatNumber - A number with a fixed (or trimmed) count of decimals, thousands-grouped in a locale.
 * @exports formatSigned - Prefixes a formatted magnitude with an explicit +/− sign.
 * @exports formatCompact - Short "1.1k" style amount for tight cells, optionally signed.
 * @exports formatMoney - A currency amount via Intl (symbol and placement from the locale), optionally signed.
 */

/** Locale every finance figure is shown in unless a caller asks otherwise ("1.234,56"). */
const DEFAULT_LOCALE = 'de-DE';

export interface FormatNumberOptions {
  /** Fraction digits to show (default 2). With `trimZeros` this is the maximum. */
  decimals?: number;
  /** Drop trailing zeros instead of always printing `decimals` digits (1100.50 → "1100.5", 100 → "100"). */
  trimZeros?: boolean;
  /** BCP 47 locale for the separators (default `de-DE`). */
  locale?: string;
  /** Thousands separators (default true). */
  grouping?: boolean;
}

export interface SignOptions {
  /** Character printed for negative values (default "-"; pass "−" (U+2212) for typeset figures). */
  minus?: string;
  /** Prefix printed when the value is zero (default none). */
  zeroSign?: string;
}

/**
 * Formats a number with a fixed count of decimals in a locale, e.g. `formatNumber(1234.5)` → "1.234,50",
 * `formatNumber(1234.5, { decimals: 0, locale: 'en-US' })` → "1,235". Rounds like Intl: the shortest decimal
 * form, half away from zero (1.005 → "1,01"), which is not what `toFixed` does (1.005 → "1.00").
 */
export function formatNumber(value: number, options: FormatNumberOptions = {}): string {
  const { decimals = 2, trimZeros = false, locale = DEFAULT_LOCALE, grouping = true } = options;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: trimZeros ? 0 : decimals,
    maximumFractionDigits: decimals,
    useGrouping: grouping,
  }).format(value);
}

/**
 * Formats a value with an explicit sign: "+" when positive, `minus` when negative, `zeroSign` when zero.
 * The magnitude (absolute value) is rendered by `formatMagnitude`, e.g.
 * `formatSigned(-0.5, n => formatNumber(n))` → "-0,50".
 */
export function formatSigned(
  value: number,
  formatMagnitude: (magnitude: number) => string,
  options: SignOptions = {},
): string {
  const { minus = '-', zeroSign = '' } = options;
  const sign = value > 0 ? '+' : value < 0 ? minus : zeroSign;
  return `${sign}${formatMagnitude(Math.abs(value))}`;
}

/**
 * Short amount for tight cells: whole numbers below 1000, thousands with one decimal and a "k" above
 * (1058.8 → "1.1k", 441.2 → "441"). Anything that rounds to 0 prints "0" without a sign. With
 * `signed`, positive values get a "+".
 */
export function formatCompact(value: number, options: { signed?: boolean; minus?: string } = {}): string {
  const { signed = false, minus = '-' } = options;
  const abs = Math.abs(value);
  const magnitude = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : `${Math.round(abs)}`;
  if (magnitude === '0') return '0';
  const sign = value > 0 ? (signed ? '+' : '') : minus;
  return `${sign}${magnitude}`;
}

/**
 * Formats a currency amount with Intl, at least two decimals: `formatMoney(1234.5, 'EUR')` → "1.234,50 €".
 * With `signed`, the amount always carries a sign, zero included: `formatMoney(5, 'EUR', { signed: true })`
 * → "+5,00 €", `formatMoney(-5, 'EUR', { signed: true })` → "-5,00 €".
 *
 * @param currency - ISO 4217 code (default EUR).
 */
export function formatMoney(
  value: number,
  currency = 'EUR',
  options: { locale?: string; signed?: boolean } = {},
): string {
  const { locale = DEFAULT_LOCALE, signed = false } = options;
  const format = (n: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);
  return signed ? formatSigned(value, format, { zeroSign: '+' }) : format(value);
}
