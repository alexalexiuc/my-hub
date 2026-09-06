'use client';

import { useState } from 'react';
import { SectionCard } from '@/components/SectionCard';
import { ThemePicker, useThemes } from '@/components';
import { THEME_SCOPES, type ThemeKey, type ThemeScope } from '@my-hub/shared/constants';
import { apiFetch } from '@/lib/utils';

/**
 * Theme picker for the whole app plus each themed feature. Mirrors NotificationsSection's shape:
 * config-driven rows, optimistic local state, one PUT per change.
 *
 * Selection is applied to the live ThemeProvider before the request resolves, so the whole page —
 * including this section — repaints instantly and the choice can be judged in place.
 */
export function AppearanceSection() {
  const { themes, overrides, setTheme } = useThemes();
  const [saving, setSaving] = useState<ThemeScope | null>(null);

  async function persist(scope: ThemeScope, themeKey: ThemeKey | null) {
    setSaving(scope);
    // The provider is the single source of truth for what is set vs inherited, so updating it is
    // all this needs to do — the row below re-derives from it.
    setTheme(scope, themeKey);
    try {
      await apiFetch('/api/user/theme-preferences', { method: 'PUT', body: { scope, themeKey } });
    } finally {
      setSaving(null);
    }
  }

  return (
    <SectionCard title="Appearance">
      <div className="space-y-6">
        {THEME_SCOPES.map(({ key, label }) => {
          const isGlobal = key === 'global';
          // A feature row shows a concrete selection only when it has its own override; otherwise
          // it is inheriting, and the dropdown sits on "Same as everything".
          const value = isGlobal ? themes.global : (overrides[key] ?? null);

          return (
            <div key={key}>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--subtle)]">{label}</p>
              <ThemePicker
                value={value ?? null}
                effectiveKey={themes[key]}
                disabled={saving === key}
                onChange={themeKey => persist(key, themeKey)}
                inheritLabel={isGlobal ? undefined : 'Same as everything'}
                onInherit={isGlobal ? undefined : () => persist(key, null)}
              />
            </div>
          );
        })}
        <p className="text-xs text-[var(--subtle)]">
          Each feature follows your &ldquo;Everything&rdquo; choice unless you give it one of its own.
        </p>
      </div>
    </SectionCard>
  );
}
