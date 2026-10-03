/**
 * Finance exchange rate service
 * - getExchangeRate(from, to, date) — lenient lookup: cached or fetched rate, persists missing rows; falls back to the most recent cached rate, then 1.0 (legacy — never use it to compute stored amounts)
 * - getExchangeRateQuote(from, to, date, opts?) — strict lookup returning { rate, rateDate }: exact cache row or API fetch, else the nearest cached rate within opts.maxAgeDays (default 7); throws when none — use for every stored amount
 * Types: ExchangeRateQuote, ExchangeRateQuoteOpts
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import { PromiseCacheX } from 'promise-cachex';
import { db } from '../../db/client';
import { financeCurrencyRates } from '../../db/schema/finances';
import { SupportedCurrencies, type SupportedCurrency } from '../../constants/finances';
import { daysBetweenDateStr } from '../../utils/weight-goal';

const exchangeRatePromiseCache = new PromiseCacheX({
  // Date-based rates are immutable enough for long-lived process caching.
  ttl: 30 * 24 * 60 * 60 * 1000,
});

function normalizeCurrency(currency: string): SupportedCurrency {
  const normalized = currency.trim().toUpperCase();
  if (!SupportedCurrencies.includes(normalized as SupportedCurrency)) {
    throw new Error(`Unsupported currency: ${currency}`);
  }
  return normalized as SupportedCurrency;
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
  fromCurrency: SupportedCurrency,
  toCurrency: SupportedCurrency,
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

async function getExactRateFromDb(
  fromCurrency: SupportedCurrency,
  toCurrency: SupportedCurrency,
  date: string,
): Promise<number | null> {
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

async function getMostRecentRateFromDb(
  fromCurrency: SupportedCurrency,
  toCurrency: SupportedCurrency,
): Promise<number | null> {
  const [row] = await db
    .select({ rate: financeCurrencyRates.rate })
    .from(financeCurrencyRates)
    .where(and(eq(financeCurrencyRates.fromCurrency, fromCurrency), eq(financeCurrencyRates.toCurrency, toCurrency)))
    .orderBy(desc(financeCurrencyRates.date))
    .limit(1);

  return row?.rate ?? null;
}

async function saveRateToDb(
  fromCurrency: SupportedCurrency,
  toCurrency: SupportedCurrency,
  date: string,
  rate: number,
): Promise<void> {
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

export interface ExchangeRateQuote {
  rate: number;
  /** YYYY-MM-DD the rate applies to — may differ from the requested date when a nearby rate was used. */
  rateDate: string;
}

export interface ExchangeRateQuoteOpts {
  /**
   * How many days away from the requested date a cached rate may be when neither an exact cached
   * row nor the provider has one (e.g. today's rate not published yet). Default 7. Pass Infinity
   * for display-only conversions where any known rate beats none.
   */
  maxAgeDays?: number;
}

const DEFAULT_QUOTE_MAX_AGE_DAYS = 7;

async function getNearestRateFromDb(
  fromCurrency: SupportedCurrency,
  toCurrency: SupportedCurrency,
  date: string,
): Promise<ExchangeRateQuote | null> {
  const distance = sql`abs(${financeCurrencyRates.date} - ${date}::date)`;
  const [row] = await db
    .select({ rate: financeCurrencyRates.rate, date: financeCurrencyRates.date })
    .from(financeCurrencyRates)
    .where(and(eq(financeCurrencyRates.fromCurrency, fromCurrency), eq(financeCurrencyRates.toCurrency, toCurrency)))
    // Nearest date wins; on a tie prefer the earlier (already-published) rate.
    .orderBy(distance, financeCurrencyRates.date)
    .limit(1);
  return row ? { rate: row.rate, rateDate: row.date } : null;
}

// Pairs/dates with no cached row and no provider answer, so repeated lookups (e.g. today's rate
// before it is published, on every dashboard load) skip the DB + HTTP round-trips for a while.
const QUOTE_MISS_TTL_MS = 60 * 60 * 1000;
const recentQuoteMisses = new Map<string, number>();

/**
 * Strict exchange-rate lookup for converting `from` → `to` on `date` (YYYY-MM-DD).
 * Unlike getExchangeRate it never invents a rate: it returns an exact cached row or a freshly
 * fetched (and persisted) provider rate, otherwise the nearest cached rate within
 * opts.maxAgeDays, otherwise it throws. The returned rateDate says which day's rate was used.
 */
export async function getExchangeRateQuote(
  from: string,
  to: string,
  date: string,
  opts: ExchangeRateQuoteOpts = {},
): Promise<ExchangeRateQuote> {
  const fromCurrency = normalizeCurrency(from);
  const toCurrency = normalizeCurrency(to);
  if (fromCurrency === toCurrency) return { rate: 1, rateDate: date };

  const key = `quote:${fromCurrency}:${toCurrency}:${date}`;
  const missedAt = recentQuoteMisses.get(key);
  try {
    if (missedAt != null && Date.now() - missedAt < QUOTE_MISS_TTL_MS) throw new Error('recent miss');
    // Misses throw, and PromiseCacheX evicts rejected entries, so only hits are cached here.
    const rate = await exchangeRatePromiseCache.get(key, async () => {
      const exactRate = await getExactRateFromDb(fromCurrency, toCurrency, date);
      if (exactRate != null) return exactRate;
      const fetchedRate = await fetchExchangeRateFromApi(fromCurrency, toCurrency, date);
      if (fetchedRate != null) {
        await saveRateToDb(fromCurrency, toCurrency, date, fetchedRate);
        return fetchedRate;
      }
      throw new Error('miss');
    });
    return { rate, rateDate: date };
  } catch {
    if (missedAt == null || Date.now() - missedAt >= QUOTE_MISS_TTL_MS) recentQuoteMisses.set(key, Date.now());
    const maxAgeDays = opts.maxAgeDays ?? DEFAULT_QUOTE_MAX_AGE_DAYS;
    const nearest = await getNearestRateFromDb(fromCurrency, toCurrency, date);
    if (nearest && Math.abs(daysBetweenDateStr(nearest.rateDate, date)) <= maxAgeDays) return nearest;
    throw new Error(`No ${fromCurrency}→${toCurrency} exchange rate available for ${date}. Enter the rate manually.`);
  }
}
