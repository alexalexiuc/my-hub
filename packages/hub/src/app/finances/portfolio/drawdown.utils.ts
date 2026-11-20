// Feature-scoped helpers for the Dip gauge (drawdown) card.
import { DrawdownRanges, type DrawdownLevel, type DrawdownRange } from '@my-hub/shared/constants';
import { daysBetweenDateStr, formatNumber, shiftDateStr } from '@my-hub/shared/utils';

/** Range tabs for the Dip gauge, in the order the API accepts them. */
export const DRAWDOWN_RANGE_OPTIONS = (Object.keys(DrawdownRanges) as DrawdownRange[]).map(key => ({
  key,
  label: key,
}));

/** Which rolling-peak window the chart plots. */
export const DRAWDOWN_WINDOWS = [
  { key: 'dd30', label: '30d' },
  { key: 'dd52', label: '52w' },
] as const;
export type DrawdownWindow = (typeof DRAWDOWN_WINDOWS)[number]['key'];

const MINUS = '−';

/** A drawdown fraction as a signed percent with a typeset minus ("−6.8%"); "—" when null. */
export function formatDrawdown(value: number | null): string {
  if (value === null) return '—';
  const text = `${formatNumber(Math.abs(value) * 100, { decimals: 1 })}%`;
  return value < 0 && Math.abs(value) >= 0.0005 ? `${MINUS}${text}` : text;
}

/** A change in percentage points with an explicit sign ("−1.7 pp", "+0.4 pp"). */
export function formatPp(fractionDelta: number): string {
  const pp = Math.round(fractionDelta * 1000) / 10;
  const sign = pp > 0 ? '+' : pp < 0 ? MINUS : '';
  return `${sign}${formatNumber(Math.abs(pp), { decimals: 1 })} pp`;
}

/** Theme colour for a drawdown level: neutral text, amber, red. */
export function drawdownColor(level: DrawdownLevel): string {
  return level === 'red' ? 'var(--red)' : level === 'amber' ? 'var(--amber)' : 'var(--text)';
}

/**
 * Y axis for the drawdown chart: 0% at the top, down to the lowest value (never shallower than −10%),
 * rounded down to a tick step. Returns the axis minimum and the tick values from 0 downwards.
 */
export function drawdownAxis(lowest: number): { min: number; ticks: number[] } {
  const step = lowest < -0.2 ? 0.05 : 0.02;
  const min = Math.min(-0.1, Math.floor((lowest - 1e-9) / step) * step);
  const ticks: number[] = [];
  for (let v = 0; v >= min - 1e-9; v -= step) ticks.push(Math.round(v * 1e4) / 1e4);
  return { min, ticks };
}

/** `count` evenly spaced epoch-ms ticks from `startMs` to `endMs` inclusive. */
export function evenTicks(startMs: number, endMs: number, count: number): number[] {
  if (count < 2 || endMs <= startMs) return [startMs];
  return Array.from({ length: count }, (_, i) => Math.round(startMs + ((endMs - startMs) * i) / (count - 1)));
}

/** Short day label for an epoch-ms tick ("19 Nov"). */
export function formatDayTick(t: number): string {
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** Day label with the year for tooltips and info lines ("19 Nov 2026"). */
export function formatDayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** True when `pricesAsOf` is older than the latest weekday before `today` (the most recent close we should have). */
export function isDrawdownStale(pricesAsOf: string, today: string): boolean {
  let expected = shiftDateStr(today, -1);
  // Skip back over the weekend (Sunday → Friday, Saturday → Friday).
  while ([0, 6].includes(new Date(`${expected}T00:00:00Z`).getUTCDay())) expected = shiftDateStr(expected, -1);
  return daysBetweenDateStr(pricesAsOf, expected) > 0;
}
