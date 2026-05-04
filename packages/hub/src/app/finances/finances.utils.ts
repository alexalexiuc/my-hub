import type { BudgetInfo } from '@/app/api/finances/contracts';

/**
 * Sorts budgets with the active budget first, then alphabetically by name.
 */
export function sortBudgets(budgets: BudgetInfo[]): BudgetInfo[] {
  return [...budgets].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
