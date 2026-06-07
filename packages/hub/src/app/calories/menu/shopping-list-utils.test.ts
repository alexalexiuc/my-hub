import { describe, expect, it } from 'vitest';
import { cleanItem, extractItems, categorise } from './shopping-list-utils';

// ---------------------------------------------------------------------------
// cleanItem
// ---------------------------------------------------------------------------

describe('cleanItem', () => {
  it('lowercases input', () => {
    expect(cleanItem('Salmon')).toBe('salmon');
  });

  it('strips articles', () => {
    expect(cleanItem('a chicken breast')).toBe('chicken breast');
    expect(cleanItem('the salad')).toBe('salad');
    expect(cleanItem('an egg')).toBe('egg');
  });

  it('strips filler nouns', () => {
    expect(cleanItem('bowl of rice')).toBe('rice');
    expect(cleanItem('side of vegetables')).toBe('vegetables');
  });

  it('removes cooking adjectives', () => {
    expect(cleanItem('grilled chicken')).toBe('chicken');
    expect(cleanItem('roasted vegetables')).toBe('vegetables');
    expect(cleanItem('scrambled eggs')).toBe('eggs');
  });

  it('filters out single-character tokens after cleaning', () => {
    // 'a' stripped → remaining token 'e' (from 'egg' → no, 'egg' is fine)
    // Edge: all tokens become 1 char → empty string
    expect(cleanItem('a')).toBe('');
  });

  it('trims surrounding whitespace from result', () => {
    expect(cleanItem('  salmon  ')).toBe('salmon');
  });

  it('handles multiple cooking words in sequence', () => {
    expect(cleanItem('fresh grilled lean chicken')).toBe('chicken');
  });
});

// ---------------------------------------------------------------------------
// extractItems
// ---------------------------------------------------------------------------

describe('extractItems', () => {
  it('splits on "with"', () => {
    const items = extractItems('Grilled salmon with quinoa');
    expect(items).toContain('salmon');
    expect(items).toContain('quinoa');
  });

  it('splits on "and"', () => {
    const items = extractItems('chicken and broccoli');
    expect(items).toContain('chicken');
    expect(items).toContain('broccoli');
  });

  it('splits on commas', () => {
    const items = extractItems('rice, peas, carrots');
    expect(items).toContain('rice');
    expect(items).toContain('peas');
    expect(items).toContain('carrots');
  });

  it('splits on "served with"', () => {
    const items = extractItems('beef stir-fry served with brown rice');
    expect(items).toContain('brown rice');
  });

  it('splits on "topped with"', () => {
    const items = extractItems('pasta topped with tomato sauce');
    expect(items).toContain('pasta');
    expect(items).toContain('tomato sauce');
  });

  it('filters out tokens shorter than 3 characters after cleaning', () => {
    const items = extractItems('on a');
    expect(items.every(i => i.length > 2)).toBe(true);
  });

  it('deduplication is not done here — caller is responsible', () => {
    const items = extractItems('chicken and chicken');
    expect(items.filter(i => i === 'chicken').length).toBe(2);
  });

  it('handles a realistic meal description end-to-end', () => {
    const items = extractItems('Grilled chicken Caesar salad with avocado and lemon dressing');
    expect(items).toContain('chicken caesar salad');
    expect(items).toContain('avocado');
    expect(items).toContain('lemon dressing');
  });
});

// ---------------------------------------------------------------------------
// categorise
// ---------------------------------------------------------------------------

describe('categorise', () => {
  it('categorises chicken as Proteins', () => {
    expect(categorise('chicken breast')).toBe('Proteins');
  });

  it('categorises salmon as Proteins', () => {
    expect(categorise('salmon fillet')).toBe('Proteins');
  });

  it('categorises yogurt as Dairy', () => {
    expect(categorise('greek yogurt')).toBe('Dairy');
  });

  it('categorises feta as Dairy', () => {
    expect(categorise('feta cheese')).toBe('Dairy');
  });

  it('categorises rice as Grains & Carbs', () => {
    expect(categorise('brown rice')).toBe('Grains & Carbs');
  });

  it('categorises quinoa as Grains & Carbs', () => {
    expect(categorise('quinoa')).toBe('Grains & Carbs');
  });

  it('categorises broccoli as Vegetables', () => {
    expect(categorise('broccoli')).toBe('Vegetables');
  });

  it('categorises spinach as Vegetables', () => {
    expect(categorise('baby spinach')).toBe('Vegetables');
  });

  it('categorises banana as Fruits', () => {
    expect(categorise('banana')).toBe('Fruits');
  });

  it('categorises berries as Fruits (partial keyword match)', () => {
    expect(categorise('blueberries')).toBe('Fruits');
  });

  it('falls back to Other for unknown items', () => {
    expect(categorise('tahini')).toBe('Other');
    expect(categorise('olive oil')).toBe('Other');
  });

  it('is case-insensitive', () => {
    expect(categorise('SALMON')).toBe('Proteins');
    expect(categorise('Rice')).toBe('Grains & Carbs');
  });
});
