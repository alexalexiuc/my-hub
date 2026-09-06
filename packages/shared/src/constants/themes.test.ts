import { describe, expect, it } from 'vitest';
import { THEME_KEYS, DEFAULT_THEME_BY_SCOPE, isThemeKey, themeClassName } from './themes';

describe('THEME_KEYS', () => {
  it('has exactly 40 unique entries', () => {
    expect(new Set(THEME_KEYS).size).toBe(40);
    expect(THEME_KEYS).toHaveLength(40);
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
