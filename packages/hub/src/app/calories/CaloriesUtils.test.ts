import { describe, expect, it } from 'vitest';
import { pctToGrams, gramsToPct, computeMacroSummary } from './CaloriesUtils';

describe('pctToGrams', () => {
  it('converts percentage to grams for protein/carbs (4 kcal/g)', () => {
    expect(pctToGrams('30', 4, 2000)).toBe('150');
  });

  it('converts percentage to grams for fat (9 kcal/g)', () => {
    expect(pctToGrams('20', 9, 2000)).toBe('44');
  });

  it('returns empty string when pct is empty', () => {
    expect(pctToGrams('', 4, 2000)).toBe('');
  });

  it('returns empty string when maxCalNum is 0', () => {
    expect(pctToGrams('30', 4, 0)).toBe('');
  });

  it('rounds to nearest integer', () => {
    expect(pctToGrams('33', 4, 2000)).toBe('165');
  });
});

describe('gramsToPct', () => {
  it('converts grams to percentage for protein/carbs (4 kcal/g)', () => {
    expect(gramsToPct('150', 4, 2000)).toBe('30');
  });

  it('converts grams to percentage for fat (9 kcal/g)', () => {
    expect(gramsToPct('44', 9, 2000)).toBe('20');
  });

  it('returns empty string when grams is empty', () => {
    expect(gramsToPct('', 4, 2000)).toBe('');
  });

  it('returns empty string when maxCalNum is 0', () => {
    expect(gramsToPct('150', 4, 0)).toBe('');
  });

  it('rounds to nearest integer', () => {
    expect(gramsToPct('100', 4, 2000)).toBe('20');
  });

  it('is roughly inverse of pctToGrams', () => {
    const grams = pctToGrams('25', 4, 2000);
    expect(gramsToPct(grams, 4, 2000)).toBe('25');
  });
});

describe('computeMacroSummary', () => {
  it('returns used/remaining for % mode', () => {
    const result = computeMacroSummary('%', '30', '40', '20', null);
    expect(result).toEqual({ used: 90, remaining: 10, isOver: false });
  });

  it('sets isOver when % total exceeds 100', () => {
    const result = computeMacroSummary('%', '40', '40', '30', null);
    expect(result).toEqual({ used: 110, remaining: -10, isOver: true });
  });

  it('returns used/remaining for g mode with maxCalNum', () => {
    // 150g protein * 4 = 600 kcal = 30%, 200g carbs * 4 = 800 kcal = 40%, 44g fat * 9 = 396 ≈ 20%
    const result = computeMacroSummary('g', '150', '200', '44', 2000);
    expect(result).toEqual({ used: 90, remaining: 10, isOver: false });
  });

  it('sets isOver when g mode total exceeds 100%', () => {
    const result = computeMacroSummary('g', '200', '200', '100', 2000);
    expect(result!.isOver).toBe(true);
  });

  it('returns null for g mode without maxCalNum', () => {
    expect(computeMacroSummary('g', '150', '200', '44', null)).toBeNull();
  });
});
