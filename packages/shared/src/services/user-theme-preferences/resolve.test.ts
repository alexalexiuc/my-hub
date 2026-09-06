import { describe, expect, it } from 'vitest';
import { resolveThemeMap, type UserThemePreferenceRow } from './user-theme-preferences';
import { DEFAULT_THEME_BY_SCOPE } from './config';

describe('resolveThemeMap', () => {
  it('returns all defaults when there are no stored rows', () => {
    expect(resolveThemeMap([])).toEqual(DEFAULT_THEME_BY_SCOPE);
  });

  it('resolves global to the stored global row when set', () => {
    const rows: UserThemePreferenceRow[] = [{ scope: 'global', themeKey: 'violet-soft' }];
    const resolved = resolveThemeMap(rows);

    expect(resolved.global).toBe('violet-soft');
  });

  it('resolves a feature scope with no override to the stored global row', () => {
    const rows: UserThemePreferenceRow[] = [{ scope: 'global', themeKey: 'violet-soft' }];
    const resolved = resolveThemeMap(rows);

    expect(resolved.travel).toBe('violet-soft');
    expect(resolved.finances).toBe('violet-soft');
    expect(resolved.calories).toBe('violet-soft');
  });

  it('falls back to the feature own signature default when neither the feature nor global is set', () => {
    const resolved = resolveThemeMap([]);

    expect(resolved.travel).toBe(DEFAULT_THEME_BY_SCOPE.travel);
    expect(resolved.finances).toBe(DEFAULT_THEME_BY_SCOPE.finances);
    expect(resolved.calories).toBe(DEFAULT_THEME_BY_SCOPE.calories);
  });

  it('prefers a feature-scope override over the stored global row', () => {
    const rows: UserThemePreferenceRow[] = [
      { scope: 'global', themeKey: 'violet-soft' },
      { scope: 'finances', themeKey: 'emerald-deep' },
    ];
    const resolved = resolveThemeMap(rows);

    expect(resolved.finances).toBe('emerald-deep');
    expect(resolved.global).toBe('violet-soft');
    expect(resolved.travel).toBe('violet-soft');
  });
});
