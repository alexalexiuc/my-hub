import { describe, expect, it } from 'vitest';
import {
  sortBudgets,
  sortBySpentDesc,
  sortTransactionsByDateDesc,
  currentMonthString,
  normalizeYearMonth,
  getCategoryFallbackLetter,
} from './finances.utils';
import { CreateBudgetSchema } from './finances-form.schema';
import type { BudgetInfo } from '@/app/api/finances/budget/budget.schema';

function makeBudget(overrides: Partial<BudgetInfo> & { id: number; name: string }): BudgetInfo {
  return {
    defaultCurrency: 'EUR',
    createdByUserId: 'user-1',
    isOwner: true,
    isActive: false,
    ...overrides,
  };
}

describe('sortBudgets', () => {
  it('places the active budget first', () => {
    const budgets = [
      makeBudget({ id: 1, name: 'Alpha', isActive: false }),
      makeBudget({ id: 2, name: 'Beta', isActive: true }),
    ];
    const result = sortBudgets(budgets);
    expect(result[0]!.id).toBe(2);
  });

  it('sorts remaining budgets alphabetically by name', () => {
    const budgets = [
      makeBudget({ id: 1, name: 'Zebra', isActive: false }),
      makeBudget({ id: 2, name: 'Alpha', isActive: false }),
      makeBudget({ id: 3, name: 'Mango', isActive: false }),
    ];
    const result = sortBudgets(budgets);
    expect(result.map(b => b.name)).toEqual(['Alpha', 'Mango', 'Zebra']);
  });

  it('returns active first then remaining sorted alphabetically', () => {
    const budgets = [
      makeBudget({ id: 1, name: 'Zebra', isActive: false }),
      makeBudget({ id: 2, name: 'Alpha', isActive: false }),
      makeBudget({ id: 3, name: 'Middle', isActive: true }),
    ];
    const result = sortBudgets(budgets);
    expect(result[0]!.name).toBe('Middle');
    expect(result.slice(1).map(b => b.name)).toEqual(['Alpha', 'Zebra']);
  });

  it('does not mutate the original array', () => {
    const budgets = [
      makeBudget({ id: 1, name: 'B', isActive: true }),
      makeBudget({ id: 2, name: 'A', isActive: false }),
    ];
    const original = [...budgets];
    sortBudgets(budgets);
    expect(budgets).toEqual(original);
  });

  it('returns empty array for empty input', () => {
    expect(sortBudgets([])).toEqual([]);
  });
});

describe('CreateBudgetSchema', () => {
  it('accepts a valid budget name and currency', () => {
    const result = CreateBudgetSchema.safeParse({ name: 'Household', defaultCurrency: 'EUR' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty name', () => {
    const result = CreateBudgetSchema.safeParse({ name: '', defaultCurrency: 'EUR' });
    expect(result.success).toBe(false);
  });

  it('rejects a whitespace-only name', () => {
    const result = CreateBudgetSchema.safeParse({ name: '   ', defaultCurrency: 'EUR' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty currency', () => {
    const result = CreateBudgetSchema.safeParse({ name: 'Household', defaultCurrency: '' });
    expect(result.success).toBe(false);
  });

  it('trims whitespace from name before validation', () => {
    const result = CreateBudgetSchema.safeParse({ name: '  My Budget  ', defaultCurrency: 'USD' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('My Budget');
    }
  });
});

describe('sortBySpentDesc', () => {
  it('sorts rows by spent descending', () => {
    const rows = [
      { id: 1, spent: 30 },
      { id: 2, spent: 120 },
      { id: 3, spent: 45 },
    ];
    expect(sortBySpentDesc(rows).map(row => row.id)).toEqual([2, 3, 1]);
  });

  it('does not mutate the original array', () => {
    const rows = [
      { id: 1, spent: 30 },
      { id: 2, spent: 120 },
    ];
    const original = [...rows];
    sortBySpentDesc(rows);
    expect(rows).toEqual(original);
  });
});

describe('sortTransactionsByDateDesc', () => {
  it('sorts by date desc then id desc', () => {
    const rows = [
      { id: 1, date: '2026-05-10' },
      { id: 3, date: '2026-05-11' },
      { id: 2, date: '2026-05-11' },
    ];
    expect(sortTransactionsByDateDesc(rows).map(row => row.id)).toEqual([3, 2, 1]);
  });

  it('does not mutate the original array', () => {
    const rows = [
      { id: 1, date: '2026-05-10' },
      { id: 2, date: '2026-05-11' },
    ];
    const original = [...rows];
    sortTransactionsByDateDesc(rows);
    expect(rows).toEqual(original);
  });
});

describe('currentMonthString', () => {
  it('formats dates as YYYY-MM', () => {
    expect(currentMonthString(new Date('2026-05-13T00:00:00Z'))).toBe('2026-05');
  });
});

describe('normalizeYearMonth', () => {
  it('returns valid YYYY-MM strings unchanged', () => {
    expect(normalizeYearMonth('2026-11', '2026-01')).toBe('2026-11');
  });

  it('falls back when value is invalid', () => {
    expect(normalizeYearMonth('2026-1', '2026-01')).toBe('2026-01');
  });
});

describe('getCategoryFallbackLetter', () => {
  it('returns uppercase first character', () => {
    expect(getCategoryFallbackLetter('groceries')).toBe('G');
  });

  it('returns ? for empty names', () => {
    expect(getCategoryFallbackLetter('')).toBe('?');
  });
});
