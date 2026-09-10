'use client';

import { useEffect, useRef } from 'react';
import { groupThemeOptions, THEME_OPTIONS, themeLabel, type ThemeKey } from '@my-hub/shared/constants';
import { ThemeSwatch } from '@/components/ThemeSwatch';
import { Button, Card, IconButton } from '@/components';
import { ChevronLeftOutlineIcon, ChevronRightOutlineIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

const FLAT_KEYS = THEME_OPTIONS.map(o => o.value);

export type ThemeGalleryProps = {
  /** The concrete theme currently being previewed. */
  value: ThemeKey;
  onChange: (key: ThemeKey) => void;
};

/**
 * Browse-only theme picker: a big stepper (Prev/Next buttons or Left/Right arrow keys) for
 * flipping through themes one at a time, plus a grouped swatch grid for jumping straight to one
 * by eye. Neither ever touches the network — `onChange` only updates the caller's local preview
 * state, so browsing all 40 costs nothing until the caller explicitly persists a choice.
 */
export function ThemeGallery({ value, onChange }: ThemeGalleryProps) {
  const groupsRef = useRef(groupThemeOptions());
  // Read the latest value/onChange in the window listener below without re-attaching it on
  // every step — re-subscribing per keystroke is wasteful and briefly drops key repeat.
  const stateRef = useRef({ value, onChange });
  stateRef.current = { value, onChange };

  function step(delta: 1 | -1, current: ThemeKey, onChangeFn: (key: ThemeKey) => void) {
    const i = FLAT_KEYS.indexOf(current);
    // Falls back to the current value only if `value` were ever not one of the known keys —
    // the modulo arithmetic always lands in bounds otherwise, `noUncheckedIndexedAccess` just
    // can't prove it.
    const next = FLAT_KEYS[(i + delta + FLAT_KEYS.length) % FLAT_KEYS.length] ?? current;
    onChangeFn(next);
  }

  useEffect(() => {
    // A `onKeyDown` on this component's own wrapper only fires once focus is already somewhere
    // inside it — arriving at the page and pressing an arrow key immediately would do nothing.
    // The stepper is this page's single global browsing shortcut, so it listens on `window`
    // instead, guarded so it never hijacks arrow keys while the user is typing or navigating a
    // native control (a select, or scrubbing a range/date input) elsewhere on the page.
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      e.preventDefault();
      const { value: current, onChange: onChangeFn } = stateRef.current;
      step(e.key === 'ArrowLeft' ? -1 : 1, current, onChangeFn);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="space-y-5">
      {/* Stepper: browse one at a time with Prev/Next or the ← → arrow keys. A 3-column grid
          keeps the Prev/Next columns a fixed width, so they never shift as the middle theme
          name's length changes between themes (a plain centered flex row would recenter the
          whole row, moving both buttons, every time the label's width changed). */}
      <Card compact className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-5">
        <IconButton
          label="Previous theme"
          icon={<ChevronLeftOutlineIcon className="size-4" />}
          onClick={() => step(-1, value, onChange)}
        />

        <div className="flex flex-col items-center justify-self-center gap-2">
          <ThemeSwatch themeKey={value} size="lg" />
          <span className="text-sm font-medium text-[var(--text)]">{themeLabel(value)}</span>
        </div>

        <IconButton
          label="Next theme"
          icon={<ChevronRightOutlineIcon className="size-4" />}
          onClick={() => step(1, value, onChange)}
          className="justify-self-end"
        />
      </Card>

      {/* Grid: jump straight to one by eye, grouped by colour family. */}
      <div className="space-y-4">
        {groupsRef.current.map(group => (
          <div key={group.name}>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--subtle)]">{group.name}</p>
            <div className="flex flex-wrap gap-2">
              {group.options.map(option => {
                const active = option.value === value;
                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant="transparent"
                    aria-pressed={active}
                    aria-label={option.label}
                    title={option.label}
                    onClick={() => onChange(option.value)}
                    className={cn(
                      'rounded-full p-0.5',
                      active ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg)]' : 'hover:opacity-80',
                    )}
                  >
                    <ThemeSwatch themeKey={option.value} size="sm" />
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
