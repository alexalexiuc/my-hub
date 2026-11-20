/**
 * Portfolio drawdown math (pure, no DB)
 * - rollingDrawdown(dates, values, windowDays) — value ÷ highest value in the trailing calendar window − 1
 * - buildBasketDrawdown(series) — target-weighted basket index with 30-day and 52-week drawdown per trading day
 * - drawdownLevel(dd, thresholds?) — neutral / amber / red bucket for a drawdown fraction
 * Types: DrawdownPriceSeries, BasketDrawdownPoint
 */
import {
  DRAWDOWN_LONG_WINDOW_DAYS,
  DRAWDOWN_SHORT_WINDOW_DAYS,
  DrawdownThresholds,
  type DrawdownLevel,
} from '../constants/finances';
import { daysBetweenDateStr } from './weight-goal';

export interface DrawdownPriceSeries {
  /** Stable key, e.g. the Yahoo symbol. */
  key: string;
  /** Target weight; any positive scale, normalised across the series passed in. */
  weight: number;
  /** Daily closes, date ascending (`YYYY-MM-DD`). */
  prices: { date: string; close: number }[];
}

export interface BasketDrawdownPoint {
  date: string;
  /** Chained basket index, 100 on the first day. */
  basket: number;
  /** Drawdown from the highest basket value in the last 30 calendar days, ≤ 0. */
  dd30: number;
  /** Drawdown from the highest basket value in the last 365 calendar days, ≤ 0. */
  dd52: number;
}

/**
 * Returns, per date, `value / max(value over the trailing `windowDays` calendar days, including that date) − 1`.
 * Always ≤ 0; exactly 0 on a new high. `dates` must be ascending and the same length as `values`.
 */
export function rollingDrawdown(dates: string[], values: number[], windowDays: number): number[] {
  if (dates.length === 0) return [];
  const day = dates.map(d => daysBetweenDateStr(dates[0]!, d));
  // Monotonic deque of indices whose values are strictly decreasing: the head is the window maximum.
  const deque: number[] = [];
  let head = 0;
  return values.map((value, i) => {
    while (deque.length > head && values[deque[deque.length - 1]!]! <= value) deque.pop();
    deque.push(i);
    while (day[deque[head]!]! <= day[i]! - windowDays) head++;
    return value / values[deque[head]!]! - 1;
  });
}

/**
 * Builds the synthetic target basket: what 1 unit held at the target weights, rebalanced daily, would be worth.
 *
 * Daily return is Σ wᵢ × (Pᵢ,t / Pᵢ,t−1 − 1) over the union of trading days; an ETF with no close on a day the others
 * have is carried forward (return 0). The series starts on the first day every ETF has a price. Contributions and
 * actual unit counts never enter it. Series with a non-positive weight or no prices are ignored.
 */
export function buildBasketDrawdown(series: DrawdownPriceSeries[]): BasketDrawdownPoint[] {
  const used = series.filter(s => s.weight > 0 && s.prices.length > 0);
  if (used.length === 0) return [];
  const totalWeight = used.reduce((sum, s) => sum + s.weight, 0);
  const startDate = used.reduce((latest, s) => (s.prices[0]!.date > latest ? s.prices[0]!.date : latest), '');
  const dates = [...new Set(used.flatMap(s => s.prices.map(p => p.date)))].filter(d => d >= startDate).sort();
  if (dates.length === 0) return [];

  const cursors = used.map(s => ({ weight: s.weight / totalWeight, prices: s.prices, idx: 0, last: NaN }));
  const basket: number[] = [];
  let prevPrices: number[] | null = null;
  for (const date of dates) {
    const current = cursors.map(c => {
      while (c.idx < c.prices.length && c.prices[c.idx]!.date <= date) c.last = c.prices[c.idx++]!.close;
      return c.last;
    });
    if (prevPrices === null) {
      basket.push(100);
    } else {
      const prev = prevPrices;
      const r = cursors.reduce((sum, c, i) => sum + c.weight * (current[i]! / prev[i]! - 1), 0);
      basket.push(basket[basket.length - 1]! * (1 + r));
    }
    prevPrices = current;
  }

  const dd30 = rollingDrawdown(dates, basket, DRAWDOWN_SHORT_WINDOW_DAYS);
  const dd52 = rollingDrawdown(dates, basket, DRAWDOWN_LONG_WINDOW_DAYS);
  return dates.map((date, i) => ({ date, basket: basket[i]!, dd30: dd30[i]!, dd52: dd52[i]! }));
}

/** Buckets a drawdown fraction (≤ 0): at or below `red` → red, at or below `amber` → amber, else neutral. */
export function drawdownLevel(
  dd: number,
  thresholds: { amber: number; red: number } = DrawdownThresholds,
): DrawdownLevel {
  if (dd <= thresholds.red) return 'red';
  if (dd <= thresholds.amber) return 'amber';
  return 'neutral';
}
