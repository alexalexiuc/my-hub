'use client';

import { THEME_OPTIONS, type ThemeKey } from '@my-hub/shared/constants';
import { THEME_SWATCHES } from '@/lib/theme-swatches.generated';
import { Select } from './Select';
import { cn } from '@/lib/utils';

/** Sentinel for the "inherit from the global theme" choice; not a real theme key. */
const INHERIT = '__inherit__';

export type ThemePickerProps = {
  /** The selected theme, or `null` when this scope inherits from a broader one. */
  value: ThemeKey | null;
  onChange: (key: ThemeKey) => void;
  /** When provided, the list gains an "inherit" choice at the top (used by per-feature pickers). */
  inheritLabel?: string;
  onInherit?: () => void;
  disabled?: boolean;
  /** The theme actually in effect — used for the swatch when this scope is inheriting. */
  effectiveKey?: ThemeKey;
  className?: string;
};

/** Groups the flat option list into `<optgroup>`s, preserving order. */
function groupedOptions() {
  const groups: { name: string; options: (typeof THEME_OPTIONS)[number][] }[] = [];
  for (const option of THEME_OPTIONS) {
    const last = groups[groups.length - 1];
    if (last && last.name === option.group) last.options.push(option);
    else groups.push({ name: option.group, options: [option] });
  }
  return groups;
}

/** A round two-tone chip: the theme's background ringed by its accent. */
function Swatch({ themeKey }: { themeKey: ThemeKey }) {
  const { accent, bg } = THEME_SWATCHES[themeKey] ?? { accent: '#6366f1', bg: '#09090b' };
  return (
    <span
      aria-hidden
      className="block h-8 w-8 shrink-0 rounded-full"
      style={{ backgroundColor: bg, boxShadow: `inset 0 0 0 3px ${accent}` }}
    />
  );
}

/**
 * A single dropdown listing every theme by name, with the palette in effect shown as a swatch.
 * Signature presets come first, then each accent colour's three depths grouped together.
 */
export function ThemePicker({
  value,
  onChange,
  inheritLabel,
  onInherit,
  disabled = false,
  effectiveKey,
  className,
}: ThemePickerProps) {
  const swatchKey = value ?? effectiveKey ?? 'graphite-signature';

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Swatch themeKey={swatchKey} />
      <Select
        aria-label="Theme"
        disabled={disabled}
        value={value ?? (inheritLabel ? INHERIT : '')}
        onChange={e => {
          const next = e.target.value;
          if (next === INHERIT) onInherit?.();
          else onChange(next as ThemeKey);
        }}
      >
        {inheritLabel && <option value={INHERIT}>{inheritLabel}</option>}
        {groupedOptions().map(group => (
          <optgroup key={group.name} label={group.name}>
            {group.options.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
    </div>
  );
}
