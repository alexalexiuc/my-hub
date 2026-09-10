import { describe, expect, it } from 'vitest';
import {
  THEME_KEYS,
  THEME_OPTIONS,
  DEFAULT_THEME_BY_SCOPE,
  isThemeKey,
  themeClassName,
  groupThemeOptions,
} from './themes';

describe('THEME_KEYS', () => {
  it('has exactly 41 unique entries', () => {
    expect(new Set(THEME_KEYS).size).toBe(41);
    expect(THEME_KEYS).toHaveLength(41);
  });

  it('maps every key to a class ending in -theme', () => {
    for (const key of THEME_KEYS) {
      expect(themeClassName(key)).toMatch(/-theme$/);
    }
  });
});

describe('isThemeKey', () => {
  it('rejects a bogus value', () => {
    expect(isThemeKey('not-a-real-theme')).toBe(false);
  });

  it('accepts every known key', () => {
    for (const key of THEME_KEYS) {
      expect(isThemeKey(key)).toBe(true);
    }
  });
});

describe('DEFAULT_THEME_BY_SCOPE', () => {
  it('maps every scope to a valid theme key', () => {
    for (const themeKey of Object.values(DEFAULT_THEME_BY_SCOPE)) {
      expect(isThemeKey(themeKey)).toBe(true);
    }
  });
});

describe('groupThemeOptions', () => {
  it('accounts for every option exactly once, in the original order', () => {
    const groups = groupThemeOptions();
    const flattened = groups.flatMap(g => g.options);
    expect(flattened).toEqual(THEME_OPTIONS);
  });

  it('never splits one group’s options across two buckets', () => {
    const names = groupThemeOptions().map(g => g.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('puts the 2 neutral shells (Graphite, Light) in their own leading group', () => {
    const [first] = groupThemeOptions();
    expect(first?.name).toBe('Neutral');
    expect(first?.options.map(o => o.label)).toEqual(['Graphite', 'Light']);
  });

  it('puts the 3 feature-original signatures in the group right after', () => {
    const [, second] = groupThemeOptions();
    expect(second?.name).toBe('Original');
    expect(second?.options).toHaveLength(3);
  });

  it('groups every generated hue’s 3 moods together', () => {
    for (const group of groupThemeOptions().slice(2)) {
      expect(group.options).toHaveLength(3);
    }
  });
});
