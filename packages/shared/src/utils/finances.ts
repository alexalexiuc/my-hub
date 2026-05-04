/**
 * Finance domain utilities.
 *
 * @exports getCurrencySymbol - Returns the display symbol for a currency code (e.g. 'USD' → '$').
 */

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  GBP: '£',
  EUR: '€',
};

/**
 * Returns the display symbol for a currency code.
 * Falls back to the currency code itself when no symbol is registered.
 */
export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}
