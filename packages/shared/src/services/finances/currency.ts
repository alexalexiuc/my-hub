/**
 * Finance currency rate helpers
 * - getCurrencyRate(from, to, date) — looks up exchange rate from cache; returns 1.0 if not found
 * Types: (none beyond function signatures)
 */
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { financeCurrencyRates } from '../../db/schema/finances';

/**
 * Returns the exchange rate for converting `from` currency to `to` currency on `date` (YYYY-MM-DD).
 * Falls back to the most recent cached rate if an exact date match is not found.
 * Returns 1.0 if from === to or no rate is cached.
 */
export async function getCurrencyRate(from: string, to: string, date: string): Promise<number> {
  if (from === to) return 1;

  // Try exact date first
  const [exact] = await db
    .select({ rate: financeCurrencyRates.rate })
    .from(financeCurrencyRates)
    .where(
      and(
        eq(financeCurrencyRates.fromCurrency, from),
        eq(financeCurrencyRates.toCurrency, to),
        eq(financeCurrencyRates.date, date),
      ),
    )
    .limit(1);

  if (exact) return parseFloat(exact.rate);

  // Fall back to the most recent cached rate
  const [recent] = await db
    .select({ rate: financeCurrencyRates.rate })
    .from(financeCurrencyRates)
    .where(and(eq(financeCurrencyRates.fromCurrency, from), eq(financeCurrencyRates.toCurrency, to)))
    .orderBy(desc(financeCurrencyRates.date))
    .limit(1);

  return recent ? parseFloat(recent.rate) : 1;
}
