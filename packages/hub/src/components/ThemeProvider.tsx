'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { DEFAULT_THEME_BY_SCOPE, THEME_SCOPE_KEYS, type ThemeKey, type ThemeScope } from '@my-hub/shared/constants';

export type ThemeOverrides = Partial<Record<ThemeScope, ThemeKey>>;

export type ThemeProviderProps = {
  /**
   * The user's raw stored theme overrides (only the scopes they have explicitly set — absence
   * means "inherit"), resolved server-side in the root layout. Deliberately NOT the resolved
   * map: storing the resolved value per scope would lose the distinction between "explicitly
   * set to X" and "inherits X from global", so changing the global theme would have no visible
   * effect on features that never set their own override. Keeping the raw overrides and
   * re-deriving the resolved map on every render (via `resolveThemeOverrides`) means a feature
   * scope with no override always tracks the current global value automatically.
   */
  initial: ThemeOverrides;
  children: React.ReactNode;
};

export type ThemeContextValue = {
  /** The fully resolved theme for every scope (feature override -> global override -> that feature's own default). */
  themes: Record<ThemeScope, ThemeKey>;
  /** Sets (or, with `null`, clears) the override for one scope. Local state only — callers persist via their own API call. */
  setTheme: (scope: ThemeScope, key: ThemeKey | null) => void;
  /** Convenience accessor for a single scope's resolved theme. */
  resolvedFor: (scope: ThemeScope) => ThemeKey;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Pure resolution of raw stored overrides into a full theme map for all scopes. Mirrors
 * `resolveThemeMap` in `@my-hub/shared/services` (which resolves DB rows) so the client and
 * server never disagree on the fallback rule:
 * - `global` resolves to the stored global override, else `DEFAULT_THEME_BY_SCOPE.global`.
 * - Each feature scope resolves to its own override, else the stored global override, else
 *   `DEFAULT_THEME_BY_SCOPE[thatScope]`.
 */
export function resolveThemeOverrides(overrides: ThemeOverrides): Record<ThemeScope, ThemeKey> {
  const globalTheme = overrides.global ?? DEFAULT_THEME_BY_SCOPE.global;

  const resolved = {} as Record<ThemeScope, ThemeKey>;
  for (const scope of THEME_SCOPE_KEYS) {
    if (scope === 'global') {
      resolved.global = globalTheme;
      continue;
    }
    resolved[scope] = overrides[scope] ?? overrides.global ?? DEFAULT_THEME_BY_SCOPE[scope];
  }
  return resolved;
}

/** Holds the user's resolved color theme per scope, seeded from the server, previewable instantly on change. */
export function ThemeProvider({ initial, children }: ThemeProviderProps) {
  const [overrides, setOverrides] = useState<ThemeOverrides>(initial);

  const setTheme = useCallback((scope: ThemeScope, key: ThemeKey | null) => {
    setOverrides(prev => {
      if (key === null) {
        if (!(scope in prev)) return prev;
        const next = { ...prev };
        delete next[scope];
        return next;
      }
      return { ...prev, [scope]: key };
    });
  }, []);

  const themes = useMemo(() => resolveThemeOverrides(overrides), [overrides]);
  const resolvedFor = useCallback((scope: ThemeScope) => themes[scope], [themes]);

  const value = useMemo(() => ({ themes, setTheme, resolvedFor }), [themes, setTheme, resolvedFor]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Reads the current resolved theme map and the setter for previewing a change instantly. Must be used within `ThemeProvider`. */
export function useThemes(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemes must be used within a ThemeProvider');
  }
  return context;
}
