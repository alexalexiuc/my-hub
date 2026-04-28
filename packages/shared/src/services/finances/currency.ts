/**
 * Finance currency rate helpers
 * - getCurrencyRate(from, to, date) — resolves exchange rate using DB cache + external fetch fallback
 * Types: (none beyond function signatures)
 */
import { getExchangeRate } from './exchangeRates';

/**
 * Returns the exchange rate for converting `from` currency to `to` currency on `date` (YYYY-MM-DD).
 * Delegates to the exchangeRates service which handles DB cache, API fetch-on-miss,
 * and in-memory promise caching.
 */
export async function getCurrencyRate(from: string, to: string, date: string): Promise<number> {
  return getExchangeRate(from, to, date);
}
