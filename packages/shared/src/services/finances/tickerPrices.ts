/**
 * Ticker EOD price service — fetch, parse, and cache daily closing prices
 * - fetchYahooDailyCloses(yahooSymbol, fromDate, toDate) — fetch daily closes from Yahoo's unofficial chart API
 * - parseYahooChartResponse(payload, symbol, fallbackCurrency) — pure parser for the Yahoo chart payload
 * - fetchStooqDailyCloses(stooqSymbol, canonicalSymbol, currency, fromDate, toDate) — fetch daily closes from Stooq CSV
 * - parseStooqCsv(csv, canonicalSymbol, currency) — pure parser for the Stooq CSV payload
 * - getCachedTickerPrices(symbol, fromDate, toDate) — cached rows in range, date ascending
 * - getLatestTickerPrice(symbol) — most recent cached row for the symbol, null if none
 * - upsertTickerPrices(rows) — insert rows, ignoring (symbol, date) conflicts
 * - ensureTickerPriceHistory(position, fromDate) — fill missing [fromDate, today] head/tail ranges; never throws
 * - getActivePortfolioSymbols() — distinct symbols across all portfolios with earliest supply date (worker use)
 * Types: TickerPriceRow, TickerPriceSyncPosition
 */
import { and, asc, desc, eq, gte, lte, max, min, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  financePortfolioPositions,
  financePortfolioSupplies,
  financePortfolioSupplyLines,
  financeTickerPrices,
} from '../../db/schema/finances';
import {
  SupportedCurrencies,
  TickerPriceSources,
  type SupportedCurrency,
  type TickerPriceSource,
} from '../../constants/finances';
import { addDays, currentDateString, logger, toUTCDateStr, withBackoffRetry } from '../../utils';

export interface TickerPriceRow {
  symbol: string;
  date: string; // YYYY-MM-DD
  close: number;
  currency: SupportedCurrency;
  source: TickerPriceSource;
}

export interface TickerPriceSyncPosition {
  yahooSymbol: string;
  stooqSymbol: string | null;
  currency: SupportedCurrency;
}

/** Shifts a YYYY-MM-DD string by n calendar days using UTC-only arithmetic. */
function addDaysToDateString(dateStr: string, n: number): string {
  return toUTCDateStr(addDays(new Date(`${dateStr}T00:00:00Z`), n));
}

function toUnixSeconds(dateStr: string): number {
  return Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 1000);
}

function normalizeCurrency(raw: unknown, fallback: SupportedCurrency): SupportedCurrency {
  if (typeof raw === 'string') {
    const upper = raw.trim().toUpperCase();
    if (SupportedCurrencies.includes(upper as SupportedCurrency)) return upper as SupportedCurrency;
  }
  return fallback;
}

/**
 * Parses Yahoo's chart API payload into price rows. Pure — exported for tests.
 *
 * Expected shape: payload.chart.result[0] with
 *   meta.currency: string, timestamp: number[] (unix seconds),
 *   indicators.quote[0].close: (number | null)[].
 * Returns [] on any unexpected shape or chart.error (caller falls back to Stooq).
 */
export function parseYahooChartResponse(
  payload: unknown,
  symbol: string,
  fallbackCurrency: SupportedCurrency,
): TickerPriceRow[] {
  if (!payload || typeof payload !== 'object') return [];
  const chart = (payload as Record<string, unknown>).chart as Record<string, unknown> | undefined;
  if (!chart || chart.error) return [];
  const result = Array.isArray(chart.result) ? (chart.result[0] as Record<string, unknown> | undefined) : undefined;
  if (!result) return [];

  const meta = result.meta as Record<string, unknown> | undefined;
  const currency = normalizeCurrency(meta?.currency, fallbackCurrency);

  const timestamps = result.timestamp;
  const indicators = result.indicators as Record<string, unknown> | undefined;
  const quote = Array.isArray(indicators?.quote)
    ? (indicators.quote[0] as Record<string, unknown> | undefined)
    : undefined;
  const closes = quote?.close;
  if (!Array.isArray(timestamps) || !Array.isArray(closes)) return [];

  const rows: TickerPriceRow[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    const close = closes[i];
    if (typeof ts !== 'number' || typeof close !== 'number' || !Number.isFinite(close) || close <= 0) continue;
    // Daily bars carry the trading day's session-open timestamp (~07:00 UTC for
    // Xetra), so the UTC date is the trading date.
    const date = new Date(ts * 1000).toISOString().slice(0, 10);
    rows.push({ symbol, date, close, currency, source: TickerPriceSources.Yahoo });
  }
  return rows;
}

/**
 * Fetches daily closes from Yahoo's unofficial chart API. Returns [] on failure.
 * Retries on 429 only; sends a browser User-Agent to reduce 403/429 responses.
 */
export async function fetchYahooDailyCloses(
  yahooSymbol: string,
  fromDate: string,
  toDate: string,
  fallbackCurrency: SupportedCurrency = 'EUR',
): Promise<TickerPriceRow[]> {
  const period1 = toUnixSeconds(fromDate);
  // End of toDate so the last trading day is included.
  const period2 = toUnixSeconds(addDaysToDateString(toDate, 1));
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}` +
    `?period1=${period1}&period2=${period2}&interval=1d`;

  try {
    const response = await withBackoffRetry(() => fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }), {
      retries: 2,
      delay: 1000,
      shouldRetry: result => result?.status === 429,
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as unknown;
    return parseYahooChartResponse(payload, yahooSymbol, fallbackCurrency);
  } catch (err) {
    logger.warn(`[tickerPrices] Yahoo fetch failed for ${yahooSymbol}:`, err);
    return [];
  }
}

/**
 * Parses Stooq daily CSV (`Date,Open,High,Low,Close,Volume`) into price rows.
 * Pure — exported for tests. Stooq carries no currency field, so the position's
 * listing-currency hint is applied. Returns [] for HTML/"No data" bodies.
 */
export function parseStooqCsv(csv: string, canonicalSymbol: string, currency: SupportedCurrency): TickerPriceRow[] {
  const trimmed = csv.trim();
  if (!trimmed || trimmed.startsWith('<') || /^no data/i.test(trimmed)) return [];

  const rows: TickerPriceRow[] = [];
  const lines = trimmed.split('\n');
  for (const line of lines.slice(1)) {
    const cols = line.trim().split(',');
    const date = cols[0];
    const close = Number(cols[4]);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(close) || close <= 0) continue;
    rows.push({ symbol: canonicalSymbol, date, close, currency, source: TickerPriceSources.Stooq });
  }
  return rows;
}

/**
 * Fetches daily closes from Stooq's free CSV endpoint. Returns [] on failure.
 * Rows are keyed by `canonicalSymbol` (the yahooSymbol) so both sources share
 * one cache namespace.
 */
export async function fetchStooqDailyCloses(
  stooqSymbol: string,
  canonicalSymbol: string,
  currency: SupportedCurrency,
  fromDate: string,
  toDate: string,
): Promise<TickerPriceRow[]> {
  const d1 = fromDate.replaceAll('-', '');
  const d2 = toDate.replaceAll('-', '');
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSymbol)}&d1=${d1}&d2=${d2}&i=d`;

  try {
    const response = await withBackoffRetry(() => fetch(url), {
      retries: 2,
      delay: 1000,
      shouldRetry: result => result?.status === 429,
    });
    if (!response.ok) return [];
    const csv = await response.text();
    return parseStooqCsv(csv, canonicalSymbol, currency);
  } catch (err) {
    logger.warn(`[tickerPrices] Stooq fetch failed for ${stooqSymbol}:`, err);
    return [];
  }
}

/** Returns cached rows for the symbol within [fromDate, toDate], date ascending. */
export async function getCachedTickerPrices(
  symbol: string,
  fromDate: string,
  toDate: string,
): Promise<TickerPriceRow[]> {
  return db
    .select({
      symbol: financeTickerPrices.symbol,
      date: financeTickerPrices.date,
      close: financeTickerPrices.close,
      currency: financeTickerPrices.currency,
      source: financeTickerPrices.source,
    })
    .from(financeTickerPrices)
    .where(
      and(
        eq(financeTickerPrices.symbol, symbol),
        gte(financeTickerPrices.date, fromDate),
        lte(financeTickerPrices.date, toDate),
      ),
    )
    .orderBy(asc(financeTickerPrices.date));
}

/** Returns the most recent cached row for the symbol, or null when none exist. */
export async function getLatestTickerPrice(symbol: string): Promise<TickerPriceRow | null> {
  const [row] = await db
    .select({
      symbol: financeTickerPrices.symbol,
      date: financeTickerPrices.date,
      close: financeTickerPrices.close,
      currency: financeTickerPrices.currency,
      source: financeTickerPrices.source,
    })
    .from(financeTickerPrices)
    .where(eq(financeTickerPrices.symbol, symbol))
    .orderBy(desc(financeTickerPrices.date))
    .limit(1);
  return row ?? null;
}

/** Inserts price rows, ignoring rows whose (symbol, date) already exists. */
export async function upsertTickerPrices(rows: TickerPriceRow[]): Promise<void> {
  if (rows.length === 0) return;
  await db.insert(financeTickerPrices).values(rows).onConflictDoNothing();
}

async function fetchRange(position: TickerPriceSyncPosition, fromDate: string, toDate: string): Promise<void> {
  if (fromDate > toDate) return;
  let rows = await fetchYahooDailyCloses(position.yahooSymbol, fromDate, toDate, position.currency);
  if (rows.length === 0 && position.stooqSymbol) {
    rows = await fetchStooqDailyCloses(position.stooqSymbol, position.yahooSymbol, position.currency, fromDate, toDate);
  }
  if (rows.length === 0) {
    logger.warn(`[tickerPrices] No prices fetched for ${position.yahooSymbol} in ${fromDate}..${toDate}`);
    return;
  }
  // Both sources may return rows just outside the requested window — clamp.
  await upsertTickerPrices(rows.filter(r => r.date >= fromDate && r.date <= toDate));
}

/**
 * Ensures the price cache covers [fromDate, today] for the position's symbol.
 *
 * Looks up min/max cached dates and fetches only the missing head and/or tail
 * ranges (zero HTTP calls when the cache is already complete). Yahoo is tried
 * first, Stooq as fallback. Never throws on external failure — gaps are
 * forward-filled at read time and healed by the daily worker run.
 */
export async function ensureTickerPriceHistory(position: TickerPriceSyncPosition, fromDate: string): Promise<void> {
  const today = currentDateString();
  try {
    const [bounds] = await db
      .select({ minDate: min(financeTickerPrices.date), maxDate: max(financeTickerPrices.date) })
      .from(financeTickerPrices)
      .where(eq(financeTickerPrices.symbol, position.yahooSymbol));

    if (!bounds?.minDate || !bounds.maxDate) {
      await fetchRange(position, fromDate, today);
      return;
    }
    if (fromDate < bounds.minDate) {
      await fetchRange(position, fromDate, addDaysToDateString(bounds.minDate, -1));
    }
    if (bounds.maxDate < today) {
      await fetchRange(position, addDaysToDateString(bounds.maxDate, 1), today);
    }
  } catch (err) {
    logger.warn(`[tickerPrices] ensureTickerPriceHistory failed for ${position.yahooSymbol}:`, err);
  }
}

/**
 * Returns distinct ticker symbols across ALL portfolios, with each symbol's
 * earliest supply date (null when the position has no recorded buys yet).
 * Worker-only helper — intentionally not access-checked per user.
 */
export async function getActivePortfolioSymbols(): Promise<
  { yahooSymbol: string; stooqSymbol: string | null; currency: SupportedCurrency; firstBuyDate: string | null }[]
> {
  return db
    .select({
      yahooSymbol: financePortfolioPositions.yahooSymbol,
      stooqSymbol: sql<string | null>`min(${financePortfolioPositions.stooqSymbol})`,
      currency: sql<SupportedCurrency>`min(${financePortfolioPositions.currency})`,
      firstBuyDate: min(financePortfolioSupplies.date),
    })
    .from(financePortfolioPositions)
    .leftJoin(financePortfolioSupplyLines, eq(financePortfolioSupplyLines.positionId, financePortfolioPositions.id))
    .leftJoin(financePortfolioSupplies, eq(financePortfolioSupplies.id, financePortfolioSupplyLines.supplyId))
    .groupBy(financePortfolioPositions.yahooSymbol);
}
