'use client';

import Link from 'next/link';
import { SectionCard } from '@/components/SectionCard';
import { ThemePicker, useThemes } from '@/components';
import { THEME_SCOPES } from '@my-hub/shared/constants';
import { useThemePreference } from '@/hooks/useThemePreference';

/**
 * Theme picker for the whole app plus each themed feature. Mirrors NotificationsSection's shape:
 * config-driven rows, optimistic local state, one PUT per change (via `useThemePreference`, the
 * same persist path the Appearance gallery page uses).
 *
 * Selection is applied to the live ThemeProvider before the request resolves, so the whole page —
 * including this section — repaints instantly and the choice can be judged in place. For a
 * side-by-side look at what each theme actually does to real components before picking one,
 * "Browse all themes" links to the dedicated gallery page instead.
 */
export function AppearanceSection() {
  const { themes, overrides } = useThemes();
  const { persist, savingScope } = useThemePreference();

  return (
    <SectionCard
      title="Appearance"
      action={
        <Link href="/appearance" className="text-xs font-medium text-[var(--accent)] hover:underline">
          Browse all themes →
        </Link>
      }
    >
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
                disabled={savingScope === key}
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
