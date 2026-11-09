// Feature-scoped helpers for the Portfolio screen.
import { addMonthsKeepDay, formatCompact, shiftDateStr, toUTCDateStr } from '@my-hub/shared/utils';

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
  { key: '1W', label: '1W' },
  { key: '1M', label: '1M' },
  { key: '3M', label: '3M' },
  { key: '6M', label: '6M' },
  { key: 'YTD', label: 'YTD' },
  { key: '1Y', label: '1Y' },
  { key: 'ALL', label: 'All' },
] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number]['key'];

/** Type guard for a persisted range key. */
export const isHistoryRange = (value: unknown): value is HistoryRange => HISTORY_RANGES.some(r => r.key === value);

const RANGE_MONTHS: Partial<Record<HistoryRange, number>> = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12 };

/** First date (YYYY-MM-DD) covered by `range` when the chart ends on `today`; null for "All". */
export function historyRangeStart(range: HistoryRange, today: string): string | null {
  if (range === 'ALL') return null;
  if (range === '1W') return shiftDateStr(today, -7);
  if (range === 'YTD') return `${today.slice(0, 4)}-01-01`;
  return toUTCDateStr(addMonthsKeepDay(new Date(`${today}T00:00:00Z`), -RANGE_MONTHS[range]!));
}

type HistoryPoint = { date: string; value: number; invested: number };

/**
 * Daily points inside `range` (ascending input). Starts at the last point on or before the range start so the
 * change is measured from a real baseline; falls back to the whole series when history is shorter than the range.
 */
export function sliceHistory<T extends HistoryPoint>(points: T[], range: HistoryRange, today: string): T[] {
  const start = historyRangeStart(range, today);
  if (!start) return points;
  let from = 0;
  for (let i = 0; i < points.length; i++) {
    if (points[i]!.date <= start) from = i;
    else break;
  }
  return points.slice(from);
}

export type HistorySummary = {
  endValue: number;
  /** Value change over the range, new money included. */
  change: number;
  /** Market gain over the range: value change minus money put in during the range. */
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
    change,
    gain,
    gainPct: base > 0 ? (gain / base) * 100 : null,
    deposits,
    totalGain: last.value - last.invested,
  };
}

/** True when `range` reaches back to (or before) the first point, i.e. covers the whole history. */
export function rangeCoversInception(points: HistoryPoint[], range: HistoryRange, today: string): boolean {
  const start = historyRangeStart(range, today);
  const first = points[0];
  return !start || (first !== undefined && first.date > start);
}

/** X-axis label for a YYYY-MM-DD point: `9 Nov` for short ranges, `Nov '26` otherwise. */
export function formatHistoryTick(date: string, range: HistoryRange): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (range === '1W' || range === '1M' || range === '3M') {
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  }
  const month = d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
  return `${month} '${String(d.getUTCFullYear()).slice(-2)}`;
}
