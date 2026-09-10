import { useCallback, useState } from 'react';
import { useThemes } from '@/components/ThemeProvider';
import { apiFetch } from '@/lib/utils';
import type { ThemeKey, ThemeScope } from '@my-hub/shared/constants';

/**
 * Persists a theme choice for one scope: applies it to the live `ThemeProvider` immediately (so
 * every themed subtree repaints before the request resolves), then PUTs it to
 * `/api/user/theme-preferences`. `themeKey: null` clears the override so the scope goes back to
 * inheriting. Shared by `AppearanceSection` (the profile dropdowns) and the Appearance gallery
 * page so both write through the exact same path.
 */
export function useThemePreference() {
  const { setTheme } = useThemes();
  const [savingScope, setSavingScope] = useState<ThemeScope | null>(null);

  const persist = useCallback(
    async (scope: ThemeScope, themeKey: ThemeKey | null) => {
      setSavingScope(scope);
      setTheme(scope, themeKey);
      try {
        await apiFetch('/api/user/theme-preferences', { method: 'PUT', body: { scope, themeKey } });
      } finally {
        setSavingScope(null);
      }
    },
    [setTheme],
  );

  return { persist, savingScope };
}
