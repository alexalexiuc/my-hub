import type { DayMarker } from '@my-hub/shared/constants';

export const MARKER_LABELS: Record<DayMarker, string> = {
  weekend: 'Weekend',
  holiday: 'Public holiday',
  transferred_off: 'Transferred day off',
  transferred_workday: 'Transferred workday',
  leave_taken: 'Leave taken',
  leave_planned: 'Leave planned',
};

/** Orders two YYYY-MM-DD dates into a [start, end] pair. */
export function normalizeRange(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

export function isInRange(date: string, range: [string, string] | null): boolean {
  return range !== null && date >= range[0] && date <= range[1];
}

/** Whole MDL with a thousands separator, e.g. 1058.82 → "1,059 MDL". */
export function formatMdl(value: number): string {
  return `${Math.round(value).toLocaleString('en-US')} MDL`;
}

/** "1 day" / "7 days" / "2.5 days". */
export function formatDays(value: number): string {
  return `${value} ${value === 1 ? 'day' : 'days'}`;
}

/** Signed MDL, e.g. −441.18 → "−441 MDL", 1058.8 → "+1,059 MDL". */
export function formatSignedMdl(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) return '0 MDL';
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toLocaleString('en-US')} MDL`;
}

/** Short signed amount for a day cell, e.g. 1058.8 → "+1.1k", −441.2 → "−441", 0 → "0". */
export function formatDeltaCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs < 0.5) return '0';
  const sign = value > 0 ? '+' : '−';
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}k`;
  return `${sign}${Math.round(abs)}`;
}

/**
 * Fill for a day cell: green for a gain, red for a loss, mixed into the card surface so it stays
 * saturated on any theme, stronger with magnitude relative to the largest magnitude on screen.
 * `strong` tells the cell to use the page background as text colour: semantic tokens are built to
 * contrast with --bg, so that holds on every theme. Undefined for zero so neutral days stay plain.
 */
export function deltaFill(delta: number, maxAbs: number): { background: string; strong: boolean } | undefined {
  if (Math.abs(delta) < 0.5 || maxAbs <= 0) return undefined;
  const pct = Math.round(35 + 55 * Math.min(1, Math.abs(delta) / maxAbs));
  const token = delta > 0 ? 'var(--green)' : 'var(--red)';
  return { background: `color-mix(in srgb, ${token} ${pct}%, var(--card))`, strong: pct >= 60 };
}

/** Trimmed text from a form input, or null when left blank — the "clear this field" value. */
export function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** A number typed into a form input, or null when blank or not a finite number. */
export function parseOptionalNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Inclusive calendar-day length of a YYYY-MM-DD span, e.g. 2026-05-04 → 2026-05-10 is 7. */
export function spanDays(startDate: string, endDate: string): number {
  return Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000) + 1;
}
