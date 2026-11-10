// Feature-scoped helpers for the Portfolio screen.
import { addMonthsKeepDay, formatCompact, formatNumber, shiftDateStr, toUTCDateStr } from '@my-hub/shared/utils';

export type SupplyLineDraft = {
  positionId: string;
  units: string;
  pricePerUnit: string;
  fee: string;
};

/** units × pricePerUnit + fee for a draft line; 0 for unparseable inputs. */
export function computeLineTotal(line: SupplyLineDraft): number {
  const units = Number(line.units);
  const price = Number(line.pricePerUnit);
  const fee = Number(line.fee) || 0;
  if (!Number.isFinite(units) || !Number.isFinite(price)) return 0;
  return units * price + fee;
}

/** Sum of all draft line totals, rounded to cents. */
export function computeSupplyTotal(lines: SupplyLineDraft[]): number {
  return Math.round(lines.reduce((sum, line) => sum + computeLineTotal(line), 0) * 100) / 100;
}

/** Calendar metadata for a month offset from the first of the current month (used by the projection X axis). */
export function monthMetaFromIndex(monthIndex: number): { label: string; month: number; year: number } {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + monthIndex);
  return {
    label: d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
    month: d.getUTCMonth(),
    year: d.getUTCFullYear(),
  };
}

/** Number of monthly projection steps from this month through December of `targetYear` (min 1). */
export function monthsUntilEndOfYear(targetYear: number): number {
  const now = new Date();
  return Math.max(1, (targetYear - now.getUTCFullYear()) * 12 + (11 - now.getUTCMonth()));
}

/** Categorical colours for positions, in position order (theme tokens, so they follow the active palette). */
export const POSITION_COLORS = [
  'var(--blue)',
  'var(--amber)',
  'var(--violet)',
  'var(--teal)',
  'var(--pink)',
  'var(--sky)',
  'var(--orange)',
  'var(--emerald)',
] as const;

/** Colour for the position at `index`, cycling through {@link POSITION_COLORS}. */
export function positionColor(index: number): string {
  return POSITION_COLORS[index % POSITION_COLORS.length]!;
}

/** Minimal supply shape the chart helpers read (a subset of `SupplyWithLines`). */
type ChartSupply = {
  date: string;
  lines: { positionId: number; units: number; pricePerUnit: number; fee: number }[];
};

/** One step of the stacked cost chart: epoch-ms `t` plus the running cost per position id key (`p<id>`). */
export type CostBuildupPoint = { t: number } & Record<string, number>;

/** Data key for a position in {@link buildCostBuildup} points. */
export const costKey = (positionId: number) => `p${positionId}`;

/** Epoch ms of a `YYYY-MM-DD` date at UTC midnight. */
export const dateStrToMs = (date: string) => Date.parse(`${date}T00:00:00Z`);

/**
 * Running cost (units × price + fee) per position after each supply date, oldest first.
 * Several supplies on the same date collapse into one point. When `endDate` is later than
 * the last supply, a final point repeats the totals there so a step chart reaches today.
 */
export function buildCostBuildup(
  supplies: ChartSupply[],
  positionIds: number[],
  endDate: string | null,
): CostBuildupPoint[] {
  const running: Record<string, number> = Object.fromEntries(positionIds.map(id => [costKey(id), 0]));
  const points: CostBuildupPoint[] = [];
  const sorted = [...supplies].sort((a, b) => a.date.localeCompare(b.date));
  for (const supply of sorted) {
    for (const line of supply.lines) {
      const key = costKey(line.positionId);
      if (key in running) running[key]! += line.units * line.pricePerUnit + line.fee;
    }
    const t = dateStrToMs(supply.date);
    const point = { t, ...running } as CostBuildupPoint;
    if (points.at(-1)?.t === t) points[points.length - 1] = point;
    else points.push(point);
  }
  const last = points.at(-1);
  if (last && endDate && dateStrToMs(endDate) > last.t) points.push({ ...last, t: dateStrToMs(endDate) });
  return points;
}

/** One buy of a position: when, at what unit price, and how much was spent (units × price, fees excluded). */
export type BuyPoint = { t: number; date: string; price: number; amount: number; units: number };

/** Every buy line of `positionId` across supplies, oldest first. */
export function buyPointsForPosition(supplies: ChartSupply[], positionId: number): BuyPoint[] {
  return supplies
    .flatMap(s =>
      s.lines
        .filter(l => l.positionId === positionId)
        .map(l => ({
          t: dateStrToMs(s.date),
          date: s.date,
          price: l.pricePerUnit,
          amount: l.units * l.pricePerUnit,
          units: l.units,
        })),
    )
    .sort((a, b) => a.t - b.t);
}

/** Short month label (`Dec '25` for January/December edges, else `Mar`) for an epoch-ms axis tick. */
export function formatMonthTick(t: number): string {
  const d = new Date(t);
  const month = d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
  const m = d.getUTCMonth();
  return m === 0 || m === 11 ? `${month} '${String(d.getUTCFullYear()).slice(-2)}` : month;
}

/** First-of-month epoch-ms ticks within [startMs, endMs], thinned to at most `maxTicks`. */
export function monthTicks(startMs: number, endMs: number, maxTicks = 6): number[] {
  const d = new Date(startMs);
  let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + (d.getUTCDate() > 1 ? 1 : 0), 1);
  const all: number[] = [];
  while (t <= endMs) {
    all.push(t);
    const c = new Date(t);
    t = Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + 1, 1);
  }
  const step = Math.max(1, Math.ceil(all.length / maxTicks));
  return all.filter((_, i) => i % step === 0);
}

/** Unit-price axis label: one decimal below 100 (ETF prices like 15.3), whole/compact above. */
export function formatPriceTick(value: number): string {
  return Math.abs(value) < 100 ? value.toFixed(1) : formatCompact(value);
}

/** Rounds `value` up to a readable axis maximum (1, 2, 2.5, 5 × 10ⁿ); 1 for non-positive input. */
export function niceAxisMax(value: number): number {
  if (!(value > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find(s => s * magnitude >= value) ?? 10;
  return step * magnitude;
}

// ─── Value history ranges ──────────────────────────────────────────────────

/** Date ranges offered on the portfolio value chart. */
export const HISTORY_RANGES = [
  { key: 'LAST_BUY', label: 'Last buy', title: 'Since the last buy' },
  { key: '1W', label: '1W', title: 'Last week' },
  { key: '1M', label: '1M', title: 'Last month' },
  { key: '3M', label: '3M', title: 'Last 3 months' },
  { key: '6M', label: '6M', title: 'Last 6 months' },
  { key: 'YTD', label: 'YTD', title: 'Since 1 January' },
  { key: '1Y', label: '1Y', title: 'Last year' },
  { key: 'ALL', label: 'All', title: 'All time' },
] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number]['key'];

/** Type guard for a persisted range key. */
export const isHistoryRange = (value: unknown): value is HistoryRange => HISTORY_RANGES.some(r => r.key === value);

/** What the value chart plots: market value (with deposits), profit only (no deposit jumps), or deposits only. */
export const HISTORY_SERIES = [
  { key: 'value', label: 'Value' },
  { key: 'profit', label: 'Profit' },
  { key: 'invested', label: 'Invested' },
] as const;
export type HistorySeries = (typeof HISTORY_SERIES)[number]['key'];

/** Type guard for a persisted series key. */
export const isHistorySeries = (value: unknown): value is HistorySeries => HISTORY_SERIES.some(s => s.key === value);

const RANGE_MONTHS: Partial<Record<HistoryRange, number>> = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12 };

type HistoryPoint = { date: string; value: number; invested: number };

/** Date of the most recent point where cumulative invested cash went up (the first point when it never did). */
export function lastBuyDate(points: HistoryPoint[]): string | null {
  for (let i = points.length - 1; i > 0; i--) {
    if (points[i]!.invested > points[i - 1]!.invested) return points[i]!.date;
  }
  return points[0]?.date ?? null;
}

/**
 * First date (YYYY-MM-DD) covered by `range` for a series ending on its last point; null for "All" or an empty
 * series. "Last buy" starts on the buy day, so the money of that buy is in the baseline and not counted as gain.
 */
export function historyRangeStart(range: HistoryRange, points: HistoryPoint[]): string | null {
  const end = points.at(-1)?.date;
  if (range === 'ALL' || !end) return null;
  if (range === 'LAST_BUY') return lastBuyDate(points);
  if (range === '1W') return shiftDateStr(end, -7);
  if (range === 'YTD') return `${end.slice(0, 4)}-01-01`;
  return toUTCDateStr(addMonthsKeepDay(new Date(`${end}T00:00:00Z`), -RANGE_MONTHS[range]!));
}

/**
 * Daily points inside `range` (ascending input). Starts at the last point on or before the range start so the
 * change is measured from a real baseline; falls back to the whole series when history is shorter than the range.
 */
export function sliceHistory<T extends HistoryPoint>(points: T[], range: HistoryRange): T[] {
  const start = historyRangeStart(range, points);
  if (!start) return points;
  let from = 0;
  for (let i = 0; i < points.length; i++) {
    if (points[i]!.date <= start) from = i;
    else break;
  }
  return points.slice(from);
}

/** True when `range` reaches back before the first point, i.e. covers the whole history. */
export function rangeCoversInception(points: HistoryPoint[], range: HistoryRange): boolean {
  const start = historyRangeStart(range, points);
  const first = points[0];
  return !start || (first !== undefined && first.date > start);
}

export type HistorySummary = {
  endValue: number;
  /** Cumulative cash invested at the end of the range. */
  endInvested: number;
  /** Value change over the range, new money included. */
  change: number;
  /** Market gain over the range: value change minus money put in during the range (= change in profit). */
  gain: number;
  /** `gain` relative to the starting value plus new money; null when there is nothing to compare against. */
  gainPct: number | null;
  /** Money put in during the range. */
  deposits: number;
  /** Total unrealised gain at the end of the range (value − everything invested). */
  totalGain: number;
};

/**
 * Headline numbers for a (sliced) value series; null when empty. With `fromInception` (the range reaches back
 * before the first supply) the baseline is an empty portfolio, so every contribution counts as new money and the
 * market gain equals the total gain, fees included.
 */
export function summarizeHistory(points: HistoryPoint[], fromInception = false): HistorySummary | null {
  const first = fromInception ? { value: 0, invested: 0 } : points[0];
  const last = points.at(-1);
  if (!first || !last) return null;
  const deposits = last.invested - first.invested;
  const change = last.value - first.value;
  const gain = change - deposits;
  const base = first.value + deposits;
  return {
    endValue: last.value,
    endInvested: last.invested,
    change,
    gain,
    gainPct: base > 0 ? (gain / base) * 100 : null,
    deposits,
    totalGain: last.value - last.invested,
  };
}

/** X-axis label for a YYYY-MM-DD point: `9 Nov` when the chart spans ≤ ~3 months, `Nov '26` otherwise. */
export function formatHistoryTick(date: string, spanDays: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (spanDays <= 100) return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const month = d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
  return `${month} '${String(d.getUTCFullYear()).slice(-2)}`;
}

/**
 * Vertical gradient offset (0 = top, 1 = bottom) where a series crosses zero on a chart whose Y axis spans its
 * min..max — used to colour a profit area green above zero and red below. 1 when all ≥ 0, 0 when all ≤ 0.
 */
export function zeroCrossOffset(values: number[]): number {
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (max <= 0) return 0;
  if (min >= 0) return 1;
  return max / (max - min);
}

/**
 * Y axis for [min, max] that hugs the data: the domain is the data span plus 5% padding, and the ticks are round
 * multiples of a readable step (niceAxisMax of span / `segments`) inside it.
 */
export function fitAxis(min: number, max: number, segments = 4): { domain: [number, number]; ticks: number[] } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { domain: [0, 1], ticks: [0, 1] };
  const span = max - min || Math.abs(max) * 0.1 || 1;
  const pad = span * 0.05;
  const domain: [number, number] = [min - pad, max + pad];
  const step = niceAxisMax(span / segments);
  const ticks: number[] = [];
  for (let t = Math.ceil(domain[0] / step) * step; t <= domain[1]; t += step) ticks.push(Math.round(t * 1e6) / 1e6 + 0); // + 0 turns -0 into 0
  return { domain, ticks };
}

/** Y tick label: compact (`12.5k`) when the tick step is ≥ 100, else the whole number (`1.250`) so ticks stay distinct. */
export function formatAxisTick(value: number, step: number): string {
  return step >= 100 ? formatCompact(value) : formatNumber(value, { decimals: 0 });
}

/** Dates (YYYY-MM-DD, ascending) where a new month starts, thinned to at most `maxTicks`, for long-range X axes. */
export function monthStartDates(dates: string[], maxTicks = 6): string[] {
  const starts = dates.filter((d, i) => (i === 0 ? d.endsWith('-01') : d.slice(0, 7) !== dates[i - 1]!.slice(0, 7)));
  const step = Math.max(1, Math.ceil(starts.length / maxTicks));
  return starts.filter((_, i) => i % step === 0);
}
