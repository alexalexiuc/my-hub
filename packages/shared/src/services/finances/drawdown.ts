/**
 * Portfolio drawdown ("Dip gauge") service — how far the target basket sits below its recent peak
 * - getPortfolioDrawdown(userId, budgetId, range) — basket 30-day / 52-week drawdown series, per-ETF breakdown, buy markers
 * Types: PortfolioDrawdown, DrawdownPair, DrawdownEtf, DrawdownBuy
 */
import {
  DRAWDOWN_HISTORY_BUFFER_DAYS,
  DrawdownRanges,
  DrawdownThresholds,
  DRAWDOWN_LONG_WINDOW_DAYS,
  DRAWDOWN_SHORT_WINDOW_DAYS,
  type DrawdownRange,
} from '../../constants/finances';
import {
  buildBasketDrawdown,
  currentDateString,
  rollingDrawdown,
  shiftDateStr,
  type BasketDrawdownPoint,
} from '../../utils';
import { ensureTickerPriceHistory, getCachedTickerPrices } from './tickerPrices';
import { getPortfolio, getPositions, getSupplies } from './portfolio';

export interface DrawdownPair {
  dd30: number;
  dd52: number;
}

export interface DrawdownEtf {
  symbol: string;
  /** Latest close in the listing currency. */
  price: number;
  dd30: number;
  dd52: number;
  /** Target weight as a fraction (0.7 = 70%). */
  weight: number;
  /** `dd30 × weight` in percentage points, e.g. -1.5. */
  ddTimesWeightPp: number;
}

export interface DrawdownBuy {
  date: string;
  /** Cash contributed on that date, in the portfolio base currency. */
  amount: number;
  /** Basket drawdown on the buy date; null when it predates the basket history. */
  dd30: number | null;
  dd52: number | null;
}

export interface PortfolioDrawdown {
  /** Date of the latest close behind the numbers. */
  pricesAsOf: string;
  range: DrawdownRange;
  /** Normalised target weights by display symbol. */
  weights: Record<string, number>;
  thresholds: { amber: number; red: number };
  current: {
    dd30: number;
    dd52: number;
    prev: DrawdownPair;
    atLastBuy: { date: string; dd30: number } | null;
  };
  perEtf: DrawdownEtf[];
  /** Basket series for the chosen range, date ascending. */
  series: BasketDrawdownPoint[];
  /** Every supply (not trimmed by range), date ascending. */
  buys: DrawdownBuy[];
}

/** Latest point on or before `date`, or null when the series starts later. */
function pointOnOrBefore(series: BasketDrawdownPoint[], date: string): BasketDrawdownPoint | null {
  let found: BasketDrawdownPoint | null = null;
  for (const p of series) {
    if (p.date > date) break;
    found = p;
  }
  return found;
}

/**
 * Returns the portfolio's drawdown view: a synthetic basket held at the positions' target allocations (rebalanced
 * daily, contributions ignored), its 30-day and 52-week drawdown per trading day, a per-ETF breakdown and the drawdown
 * on every buy date. Null when the portfolio has no supplies or no priced positions.
 *
 * Side effect: best-effort backfills the ticker price cache back to 395 days before the first supply, so the 52-week
 * window is full from the first day shown.
 */
export async function getPortfolioDrawdown(
  userId: string,
  budgetId: number,
  range: DrawdownRange = '3M',
): Promise<PortfolioDrawdown | null> {
  const portfolio = await getPortfolio(userId, budgetId);
  if (!portfolio) return null;
  const positions = (await getPositions(userId, budgetId, portfolio.id)).filter(p => p.targetAllocationPct > 0);
  const supplies = await getSupplies(userId, budgetId, portfolio.id);
  if (positions.length === 0 || supplies.length === 0) return null;

  const suppliesAsc = [...supplies].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const firstSupplyDate = suppliesAsc[0]!.date;
  const fetchFrom = shiftDateStr(firstSupplyDate, -DRAWDOWN_HISTORY_BUFFER_DAYS);

  // Sequential to respect the price API's rate limits; each call fetches only the missing head/tail.
  for (const position of positions) await ensureTickerPriceHistory(position, fetchFrom);
  const today = currentDateString();
  const pricesBySymbol = new Map<string, Awaited<ReturnType<typeof getCachedTickerPrices>>>();
  for (const position of positions) {
    if (!pricesBySymbol.has(position.yahooSymbol)) {
      pricesBySymbol.set(position.yahooSymbol, await getCachedTickerPrices(position.yahooSymbol, fetchFrom, today));
    }
  }

  const priced = positions.filter(p => (pricesBySymbol.get(p.yahooSymbol)?.length ?? 0) > 0);
  const totalWeight = priced.reduce((sum, p) => sum + p.targetAllocationPct, 0);
  if (totalWeight <= 0) return null;
  const full = buildBasketDrawdown(
    priced.map(p => ({
      key: p.yahooSymbol,
      weight: p.targetAllocationPct,
      prices: pricesBySymbol.get(p.yahooSymbol)!,
    })),
  );
  const last = full.at(-1);
  if (!last) return null;
  const prev = full.at(-2) ?? last;

  const days = DrawdownRanges[range];
  const shownFrom = days === null ? firstSupplyDate : shiftDateStr(last.date, -days);
  const lastBuy = suppliesAsc.at(-1)!;
  const atLastBuy = pointOnOrBefore(full, lastBuy.date);

  const perEtf = priced.map<DrawdownEtf>(p => {
    const rows = pricesBySymbol.get(p.yahooSymbol)!;
    const dates = rows.map(r => r.date);
    const closes = rows.map(r => r.close);
    const dd30 = rollingDrawdown(dates, closes, DRAWDOWN_SHORT_WINDOW_DAYS).at(-1)!;
    const dd52 = rollingDrawdown(dates, closes, DRAWDOWN_LONG_WINDOW_DAYS).at(-1)!;
    const weight = p.targetAllocationPct / totalWeight;
    return { symbol: p.symbol, price: closes.at(-1)!, dd30, dd52, weight, ddTimesWeightPp: dd30 * weight * 100 };
  });

  return {
    pricesAsOf: last.date,
    range,
    weights: Object.fromEntries(perEtf.map(e => [e.symbol, e.weight])),
    thresholds: { ...DrawdownThresholds },
    current: {
      dd30: last.dd30,
      dd52: last.dd52,
      prev: { dd30: prev.dd30, dd52: prev.dd52 },
      atLastBuy: atLastBuy ? { date: lastBuy.date, dd30: atLastBuy.dd30 } : null,
    },
    perEtf,
    series: full.filter(p => p.date >= shownFrom),
    buys: suppliesAsc.map(s => {
      const point = pointOnOrBefore(full, s.date);
      return { date: s.date, amount: s.totalAmount, dd30: point?.dd30 ?? null, dd52: point?.dd52 ?? null };
    }),
  };
}
