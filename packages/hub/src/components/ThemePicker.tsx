'use client';

import {
  THEME_HUES,
  THEME_MOODS,
  THEME_SIGNATURES,
  type ThemeHue,
  type ThemeKey,
  type ThemeMood,
} from '@my-hub/shared/constants';
import { THEME_SWATCHES } from '@/lib/theme-swatches.generated';
import { cn } from '@/lib/utils';

export type ThemePickerProps = {
  /** The currently selected theme, or `null` when this scope inherits from a broader one. */
  value: ThemeKey | null;
  onChange: (key: ThemeKey) => void;
  /** When provided, renders an "inherit" choice as the first option (used by per-feature pickers). */
  inheritLabel?: string;
  onInherit?: () => void;
  disabled?: boolean;
};

const swatchOf = (key: ThemeKey) => THEME_SWATCHES[key] ?? { accent: '#6366f1', bg: '#09090b', card: '#18181b' };

/** Splits a generated key into its hue and mood; signatures have neither. */
function partsOf(key: ThemeKey | null): { hue: ThemeHue | null; mood: ThemeMood | null } {
  if (!key || key.endsWith('-signature')) return { hue: null, mood: null };
  const [hue, mood] = key.split('-') as [ThemeHue, ThemeMood];
  return { hue, mood };
}

/** A round two-tone chip: the theme's background ring around its accent. */
function Swatch({ themeKey, size = 'md' }: { themeKey: ThemeKey; size?: 'sm' | 'md' }) {
  const { accent, bg } = swatchOf(themeKey);
  return (
    <span
      className={cn('block rounded-full', size === 'md' ? 'h-7 w-7' : 'h-5 w-5')}
      style={{ backgroundColor: bg, boxShadow: `inset 0 0 0 ${size === 'md' ? 3 : 2}px ${accent}` }}
    />
  );
}

export function ThemePicker({ value, onChange, inheritLabel, onInherit, disabled = false }: ThemePickerProps) {
  const { hue: selectedHue, mood: selectedMood } = partsOf(value);
  // Picking a hue before a mood should land somewhere sensible rather than doing nothing.
  const effectiveMood: ThemeMood = selectedMood ?? 'classic';

  const rowLabel = 'text-[11px] uppercase tracking-wider text-[var(--subtle)]';

  return (
    <div className="space-y-3">
      {/* Hue row */}
      <p className={rowLabel}>Colour</p>
      <div className="flex flex-wrap items-center gap-2">
        {inheritLabel && onInherit && (
          <button
            type="button"
            disabled={disabled}
            onClick={onInherit}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs transition disabled:opacity-50',
              value === null
                ? 'border-[var(--accent)] bg-[var(--accent-d)] text-[var(--accent)]'
                : 'border-[var(--border)] bg-[var(--card2)] text-[var(--muted)] hover:text-[var(--text)]',
            )}
          >
            {inheritLabel}
          </button>
        )}
        {THEME_HUES.map(({ key, label }) => {
          const optionKey = `${key}-${effectiveMood}` as ThemeKey;
          const active = selectedHue === key;
          return (
            <button
              key={key}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onChange(optionKey)}
              className={cn(
                'rounded-full p-0.5 transition disabled:opacity-50',
                active ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--card)]' : 'hover:opacity-80',
              )}
            >
              <Swatch themeKey={optionKey} />
            </button>
          );
        })}
      </div>

      {/* Mood row — only meaningful once a hue is chosen, so it is labelled to say so rather
          than presenting three dead buttons on first load, when a signature preset is active. */}
      <p className={rowLabel}>{selectedHue ? 'Depth' : 'Depth — pick a colour first'}</p>
      <div className="flex flex-wrap items-center gap-2">
        {THEME_MOODS.map(({ key, label, description }) => {
          const active = selectedMood === key;
          return (
            <button
              key={key}
              type="button"
              title={description}
              aria-pressed={active}
              disabled={disabled || !selectedHue}
              onClick={() => selectedHue && onChange(`${selectedHue}-${key}` as ThemeKey)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-40',
                active
                  ? 'border-[var(--accent)] bg-[var(--accent-d)] text-[var(--accent)]'
                  : 'border-[var(--border)] bg-[var(--card2)] text-[var(--muted)] hover:text-[var(--text)]',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Signature presets — the app's original hand-tuned palettes. */}
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
        <span className={rowLabel}>Signature</span>
        {THEME_SIGNATURES.map(({ key, label }) => {
          const active = value === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onChange(key)}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition disabled:opacity-50',
                active
                  ? 'border-[var(--accent)] bg-[var(--accent-d)] text-[var(--accent)]'
                  : 'border-[var(--border)] bg-[var(--card2)] text-[var(--muted)] hover:text-[var(--text)]',
              )}
            >
              <Swatch themeKey={key} size="sm" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
