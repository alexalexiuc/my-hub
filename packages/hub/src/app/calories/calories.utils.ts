/**
 * Converts a percentage of total calories to grams for a given macro.
 * @param pct - The percentage string (e.g. "30")
 * @param kcalPerG - Calories per gram for the macro (protein/carbs = 4, fat = 9)
 * @param maxCalNum - The daily calorie target
 */
export function pctToGrams(pct: string, kcalPerG: number, maxCalNum: number): string {
  if (!pct || !maxCalNum) return '';
  return String(Math.round(((Number(pct) / 100) * maxCalNum) / kcalPerG));
}

/**
 * Converts grams of a macro to a percentage of total daily calories.
 * @param g - The grams string (e.g. "150")
 * @param kcalPerG - Calories per gram for the macro (protein/carbs = 4, fat = 9)
 * @param maxCalNum - The daily calorie target
 */
export function gramsToPct(g: string, kcalPerG: number, maxCalNum: number): string {
  if (!g || !maxCalNum) return '';
  return String(Math.round(((Number(g) * kcalPerG) / maxCalNum) * 100));
}

export interface MacroSummaryData {
  used: number;
  remaining: number;
  isOver: boolean;
}

/**
 * Computes the used/remaining macro percentage summary for the profile edit form.
 * Returns null when there is nothing to display (e.g. grams mode without a calorie target).
 */
export function computeMacroSummary(
  macroMode: 'g' | '%',
  goalProtein: string,
  goalCarbs: string,
  goalFat: string,
  maxCalNum: number | null,
): MacroSummaryData | null {
  if (macroMode === '%') {
    const used = (Number(goalProtein) || 0) + (Number(goalCarbs) || 0) + (Number(goalFat) || 0);
    return { used, remaining: 100 - used, isOver: used > 100 };
  }
  if (macroMode === 'g' && maxCalNum) {
    const used =
      (Number(gramsToPct(goalProtein, 4, maxCalNum)) || 0) +
      (Number(gramsToPct(goalCarbs, 4, maxCalNum)) || 0) +
      (Number(gramsToPct(goalFat, 9, maxCalNum)) || 0);
    return { used, remaining: 100 - used, isOver: used > 100 };
  }
  return null;
}
