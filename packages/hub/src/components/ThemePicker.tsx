'use client';

import { groupThemeOptions, type ThemeKey } from '@my-hub/shared/constants';
import { ThemeSwatch } from './ThemeSwatch';
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
      <ThemeSwatch themeKey={swatchKey} />
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
        {groupThemeOptions().map(group => (
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
