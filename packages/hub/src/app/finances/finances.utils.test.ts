import { describe, expect, it } from 'vitest';
import { sortBudgets } from './finances.utils';
import { CreateBudgetSchema } from './finances-form.schema';
import type { BudgetInfo } from '@/app/api/finances/contracts';

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
    expect(result[0].id).toBe(2);
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
    expect(result[0].name).toBe('Middle');
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
