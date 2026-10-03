import type { DayMarker } from '@my-hub/shared/constants';
import type { VacationLeaveEstimate } from '@my-hub/shared/services';

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
 * Text colour class for a day cell's amount: green for a gain, red for a loss. Undefined for zero
 * so neutral days keep the normal text colour.
 */
export function deltaTextClass(delta: number): string | undefined {
  if (Math.abs(delta) < 0.5) return undefined;
  return delta > 0 ? 'text-[var(--green)]' : 'text-[var(--red)]';
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

/** The recorded leave period covering a date, if any. */
export function leaveCovering<T extends { startDate: string; endDate: string }>(
  leave: T[],
  date: string,
): T | undefined {
  return leave.find(l => l.startDate <= date && date <= l.endDate);
}

/**
 * Net money vs working the leave's days. With the pay actually received recorded, that pay minus
 * the salary forgone (estimated pay − estimated delta); otherwise the engine's estimate. Null when
 * the leave could not be priced.
 */
export function leaveDelta(leave: VacationLeaveEstimate): { value: number; actual: boolean } | null {
  const { estimate, payReceivedMdl } = leave;
  if (!estimate) return null;
  if (payReceivedMdl == null) return { value: estimate.deltaNet, actual: false };
  return { value: payReceivedMdl - (estimate.amountNet - estimate.deltaNet), actual: true };
}

/** Whether a dated rule (validFrom → validTo, null = open) covers a YYYY-MM-DD date. */
export function coversDate(rule: { validFrom: string; validTo: string | null }, date: string): boolean {
  return rule.validFrom <= date && (rule.validTo === null || date <= rule.validTo);
}

/** A 0–1 rate as a percentage, e.g. 0.12 → "12%". */
export function formatRate(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}
