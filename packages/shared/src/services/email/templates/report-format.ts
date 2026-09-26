/**
 * Formatting helpers shared by the calorie report email templates.
 *
 * Exports:
 *   MINUS            — U+2212 minus sign, for figures set in a monospace face
 *   fmt              — rounded integer with thousands separators
 *   fmtWeight        — weight to one decimal
 *   signedKcal       — kcal delta with an explicit sign
 *   fmtSignedWeight  — kg figure with an explicit sign, up to two decimals
 *   fmtGoalRate      — a signed weekly goal rate with its unit; "hold steady" or "not set" when zero
 *   energyGapSummary — surplus/deficit label, signed value and colour for a target against TDEE
 */

export const MINUS = '−';

export function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function fmtWeight(n: number): string {
  return n.toFixed(1);
}

export function signedKcal(delta: number): string {
  return delta <= 0 ? `${MINUS}${fmt(Math.abs(delta))}` : `+${fmt(delta)}`;
}

/**
 * A weight in kg with an explicit sign. Two decimals with trailing zeros trimmed, because the goal
 * rate is set in 0.05 steps and one decimal would print 0.25 as "0.3".
 */
export function fmtSignedWeight(n: number): string {
  const magnitude = Math.abs(n)
    .toFixed(2)
    .replace(/\.?0+$/, '');
  return `${n < 0 ? MINUS : '+'}${magnitude}`;
}

/**
 * A weekly goal rate for display: signed with its unit (e.g. "+0.25 kg/week") when set. A zero rate
 * reads "hold steady" only for a maintain goal; a gain or loss goal with no rate set reads "not set",
 * since telling a gaining user to hold steady misstates their goal.
 *
 * @param signedRateKg The goal's weekly rate, signed as `signedWeeklyRateKg` returns it.
 * @param direction    The goal's direction, as `goalDirection` returns it.
 * @param unit         Unit printed after a set rate.
 */
export function fmtGoalRate(signedRateKg: number, direction: number, unit: string): string {
  if (signedRateKg !== 0) return `${fmtSignedWeight(signedRateKg)} ${unit}`;
  return direction === 0 ? 'hold steady' : 'not set';
}

export interface EnergyGapSummary {
  /** Target minus TDEE: positive for a surplus, negative for a deficit. */
  gap: number;
  label: string;
  value: string;
  color: string;
}

/**
 * How a daily calorie target sits against maintenance, named for whichever side it is on. Green
 * when the gap points the way the goal does — or, on a maintain goal, stays within 100 kcal of
 * zero — and red otherwise.
 *
 * Judged by the goal's direction rather than its rate, so a gaining goal with no rate set still
 * reads its planned surplus as on-goal.
 *
 * @param targetKcal The daily calorie target.
 * @param tdee       Total daily energy expenditure.
 * @param direction  The goal's direction, as `goalDirection` returns it.
 */
export function energyGapSummary(targetKcal: number, tdee: number, direction: number): EnergyGapSummary {
  const gap = targetKcal - tdee;
  const label = gap > 0 ? 'Daily surplus' : gap < 0 ? 'Daily deficit' : 'At maintenance';
  const matchesGoal = direction === 0 ? Math.abs(gap) < 100 : Math.sign(gap) === Math.sign(direction);
  return { gap, label, value: signedKcal(gap), color: matchesGoal ? '#3db87a' : '#e05a5a' };
}
