/**
 * Finance exchange rate service
 * - getExchangeRate(from, to, date) — returns a cached or fetched exchange rate and persists missing rows
 * Types: (none beyond function signatures)
 */
import { and, desc, eq } from 'drizzle-orm';
import { PromiseCacheX } from 'promise-cachex';
import { db } from '../../db/client';
import { financeCurrencyRates } from '../../db/schema/finances';

const exchangeRatePromiseCache = new PromiseCacheX({
  // Date-based rates are immutable enough for long-lived process caching.
  ttl: 30 * 24 * 60 * 60 * 1000,
});

function normalizeCurrency(currency: string): string {
  return currency.trim().toUpperCase();
}

function buildApiUrls(fromCurrencyLower: string, date: string): string[] {
  return [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${encodeURIComponent(date)}/v1/currencies/${encodeURIComponent(fromCurrencyLower)}.min.json`,
    `https://${encodeURIComponent(date)}.currency-api.pages.dev/v1/currencies/${encodeURIComponent(fromCurrencyLower)}.min.json`,
  ];
}

export function parseApiRate(payload: unknown, fromCurrencyLower: string, toCurrencyLower: string): number | null {
  if (!payload || typeof payload !== 'object') return null;

  const root = payload as Record<string, unknown>;
  const fromMap = root[fromCurrencyLower];
  if (!fromMap || typeof fromMap !== 'object') return null;

  const rawRate = (fromMap as Record<string, unknown>)[toCurrencyLower];
  const parsed = typeof rawRate === 'number' ? rawRate : Number(rawRate);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function fetchExchangeRateFromApi(
  fromCurrency: string,
  toCurrency: string,
  date: string,
): Promise<number | null> {
  const fromCurrencyLower = fromCurrency.toLowerCase();
  const toCurrencyLower = toCurrency.toLowerCase();

  for (const url of buildApiUrls(fromCurrencyLower, date)) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) continue;

      const payload = (await response.json()) as unknown;
      const rate = parseApiRate(payload, fromCurrencyLower, toCurrencyLower);
      if (rate != null) return rate;
    } catch {
      // Try fallback host when the current endpoint is unavailable.
      continue;
    }
  }

  return null;
}

async function getExactRateFromDb(fromCurrency: string, toCurrency: string, date: string): Promise<number | null> {
  const [row] = await db
    .select({ rate: financeCurrencyRates.rate })
    .from(financeCurrencyRates)
    .where(
      and(
        eq(financeCurrencyRates.fromCurrency, fromCurrency),
        eq(financeCurrencyRates.toCurrency, toCurrency),
        eq(financeCurrencyRates.date, date),
      ),
    )
    .limit(1);

  return row?.rate ?? null;
}

async function getMostRecentRateFromDb(fromCurrency: string, toCurrency: string): Promise<number | null> {
  const [row] = await db
    .select({ rate: financeCurrencyRates.rate })
    .from(financeCurrencyRates)
    .where(and(eq(financeCurrencyRates.fromCurrency, fromCurrency), eq(financeCurrencyRates.toCurrency, toCurrency)))
    .orderBy(desc(financeCurrencyRates.date))
    .limit(1);

  return row?.rate ?? null;
}

async function saveRateToDb(fromCurrency: string, toCurrency: string, date: string, rate: number): Promise<void> {
  await db
    .insert(financeCurrencyRates)
    .values({
      fromCurrency,
      toCurrency,
      date,
      rate,
      fetchedAt: new Date(),
    })
    .onConflictDoNothing();
}

/**
 * Returns the exchange rate for converting `from` currency to `to` currency on `date` (YYYY-MM-DD).
 *
 * Lookup order:
 * 1) In-memory promise cache (prevents repeated DB/API calls for same key)
 * 2) Exact DB row
 * 3) External API fetch + DB persist
 * 4) Most recent DB fallback
 * 5) 1.0 fallback
 */
export async function getExchangeRate(from: string, to: string, date: string): Promise<number> {
  const fromCurrency = normalizeCurrency(from);
  const toCurrency = normalizeCurrency(to);

  if (fromCurrency === toCurrency) return 1;

  const cacheKey = `${fromCurrency}:${toCurrency}:${date}`;
  return exchangeRatePromiseCache.get(cacheKey, async () => {
    const exactRate = await getExactRateFromDb(fromCurrency, toCurrency, date);
    if (exactRate != null) return exactRate;

    const fetchedRate = await fetchExchangeRateFromApi(fromCurrency, toCurrency, date);
    if (fetchedRate != null) {
      await saveRateToDb(fromCurrency, toCurrency, date, fetchedRate);
      return fetchedRate;
    }

    const recentRate = await getMostRecentRateFromDb(fromCurrency, toCurrency);
    return recentRate ?? 1;
  });
}
