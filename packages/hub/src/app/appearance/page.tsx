'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components';
import { ThemeSamplePreview } from '@/components/ThemeSamplePreview';
import { useThemes } from '@/components/ThemeProvider';
import { useThemePreference } from '@/hooks/useThemePreference';
import { THEME_SCOPES, themeClassName, themeLabel, type ThemeKey, type ThemeScope } from '@my-hub/shared/constants';
import { cn } from '@/lib/utils';
import { ThemeGallery } from './ThemeGallery';

/**
 * Browsing all 40 themes by picking one, navigating to a themed page to see it, then coming back
 * to try another is exactly the round trip this page removes: every step here — the stepper, the
 * grid, the arrow keys — only updates a local preview rendered with real components, and nothing
 * is written until "Set as theme" is clicked. Drafts persist per scope while switching tabs, so
 * Travel/Finances/Calories can each be tried before deciding on any of them.
 */
export default function AppearancePage() {
  const { themes, overrides } = useThemes();
  const { persist, savingScope } = useThemePreference();

  const [scope, setScope] = useState<ThemeScope>('global');
  const [drafts, setDrafts] = useState<Partial<Record<ThemeScope, ThemeKey | null>>>({});

  const isGlobal = scope === 'global';
  const activeOverride: ThemeKey | null = isGlobal ? themes.global : (overrides[scope] ?? null);
  const draftOverride: ThemeKey | null = scope in drafts ? (drafts[scope] ?? null) : activeOverride;
  const previewKey: ThemeKey = draftOverride ?? themes[scope];
  const isDirty = draftOverride !== activeOverride;

  function setDraft(key: ThemeKey | null) {
    setDrafts(prev => ({ ...prev, [scope]: key }));
  }

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <PageHeader title="Appearance" backHref="/" />

      {/* Scope switcher */}
      <div className="mb-6 flex flex-wrap gap-2">
        {THEME_SCOPES.map(s => (
          <Button
            key={s.key}
            variant={scope === s.key ? 'accent' : 'secondary'}
            size="sm"
            aria-pressed={scope === s.key}
            onClick={() => setScope(s.key)}
          >
            {s.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {!isGlobal && (
            <button
              type="button"
              onClick={() => setDraft(null)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs transition',
                draftOverride === null
                  ? 'border-[var(--accent)] bg-[var(--accent-d)] text-[var(--accent)]'
                  : 'border-[var(--border)] bg-[var(--card2)] text-[var(--muted)] hover:text-[var(--text)]',
              )}
            >
              Match Everything ({themeLabel(themes.global)})
            </button>
          )}

          <ThemeGallery value={previewKey} onChange={setDraft} />
        </div>

        {/* Live preview, rendered under the previewed theme's real class — independent of the
            page's own active theme, and independent of the real ThemeProvider until saved. */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div
            className={cn(
              themeClassName(previewKey),
              'space-y-4 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4',
            )}
          >
            <ThemeSamplePreview />
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-xs text-[var(--subtle)]">
              Currently:{' '}
              {isGlobal || activeOverride !== null
                ? themeLabel(themes[scope])
                : `Same as Everything (${themeLabel(themes.global)})`}
            </p>
            <Button
              variant="accent"
              className="w-full"
              disabled={!isDirty || savingScope === scope}
              onClick={() => persist(scope, draftOverride)}
            >
              {savingScope === scope ? 'Saving…' : 'Set as theme'}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
