import type { BudgetInfo } from '@/app/api/finances/budget/budget.schema';
import { dateToString } from '@my-hub/shared/utils';
import { TransactionTypes } from '@my-hub/shared/constants';
import type { TransactionType } from '@my-hub/shared/constants';

/**
 * Sorts budgets with the active budget first, then alphabetically by name.
 */
export function sortBudgets(budgets: BudgetInfo[]): BudgetInfo[] {
  return [...budgets].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Sorts category-like rows by spent amount descending.
 */
export function sortBySpentDesc<T extends { spent: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.spent - a.spent);
}

/**
 * Sorts transaction-like rows by date descending, then id descending.
 */
export function sortTransactionsByDateDesc<T extends { date: string; id: number }>(rows: T[]): T[] {
  return [...rows].sort((left, right) => {
    if (left.date !== right.date) {
      return right.date.localeCompare(left.date);
    }
    return right.id - left.id;
  });
}

/**
 * Returns the current month formatted as YYYY-MM.
 */
export function currentMonthString(date: Date = new Date()): string {
  return dateToString(date, 'YYYY-MM');
}

/**
 * Normalizes a YYYY-MM query value, falling back to current month when invalid.
 */
export function normalizeYearMonth(raw: string | null, fallback: string = currentMonthString()): string {
  return raw && /^\d{4}-\d{2}$/.test(raw) ? raw : fallback;
}

/**
 * Fallback character used by category avatars when icon is missing.
 */
export function getCategoryFallbackLetter(name: string): string {
  return name[0]?.toUpperCase() ?? '?';
}

/** Maps each transaction type to its finance theme CSS variable colour. */
export const TRANSACTION_TYPE_COLORS: Record<TransactionType, string> = {
  [TransactionTypes.Expense]: 'var(--red)',
  [TransactionTypes.Income]: 'var(--green)',
  [TransactionTypes.Transfer]: 'var(--blue)',
};

/** Shared Tailwind class strings for ghost-style inputs and dropdown triggers inside FinFieldCard. */
export const finGhostInputClass = 'w-full text-[13px] text-[var(--text)]';
export const finDropdownInputClass = 'py-0 text-[13px] font-medium text-[var(--text)] placeholder:text-[var(--subtle)]';
/**
 * Transparent, underline-only styling for native `<Select>`/`<Textarea>` (which have no `ghost`
 * variant) so they match the look of ghost `<Input>` — no gray fill, just a bottom border.
 */
export const finGhostFieldClass =
  'border-0 border-b border-[var(--border)] rounded-none bg-transparent px-0 py-0.5 shadow-none text-sm text-[var(--text)] focus:border-[var(--accent)] focus:ring-0';

/** Returns relative day (Today/Yesterday), month & date if in current year, or full date otherwise. */
export function formatTransactionDate(dateStr: string): string {
  // Parse as local midnight to avoid UTC-offset shifting "Today" to "Yesterday" in negative-offset zones.
  const parts = dateStr.split('-');
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((todayStart.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString();
}
