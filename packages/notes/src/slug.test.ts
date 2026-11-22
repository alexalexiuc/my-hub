import { describe, expect, it } from 'vitest';
import { normalizeForMatch, slugify } from './slug';

describe('slugify', () => {
  it.each([
    ['Carpet cleaning', 'carpet-cleaning'],
    ['Curățare covoare', 'curatare-covoare'],
    ['Șampon și țesături', 'sampon-si-tesaturi'],
    ['Химчистка ковров', 'himchistka-kovrov'],
    ['Стиральный порошок', 'stiralnyi-poroshok'],
    ['  --Engine oil 5W-30!  ', 'engine-oil-5w-30'],
    ['???', 'note'],
  ])('%s -> %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('caps length without a trailing hyphen', () => {
    const slug = slugify('word '.repeat(40));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('normalizeForMatch', () => {
  it('lowercases and strips accents but keeps Cyrillic', () => {
    expect(normalizeForMatch('  Curățare  COVOARE ')).toBe('curatare covoare');
    expect(normalizeForMatch('Химчистка')).toBe('химчистка');
  });
});
