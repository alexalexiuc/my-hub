// Feature-scoped helpers for the Portfolio screen.

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
