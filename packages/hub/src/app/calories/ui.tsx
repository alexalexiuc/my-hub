import type React from 'react';
import { cn } from '@/lib/utils';

/**
 * Prev/next stepper for a period of time, shared by the reports tabs and the progress week view.
 * `Next` is disabled rather than hidden once the current period is reached: a control that
 * disappears makes the row jump, and every step beyond now can only be empty.
 */
export function PeriodNav({
  label,
  isCurrent,
  onPrev,
  onNext,
  compact = false,
}: {
  label: string;
  isCurrent: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** Arrows only, for rows that sit above a chart rather than a page of content. */
  compact?: boolean;
}) {
  const buttonClass =
    'rounded-lg border border-[var(--border)] bg-[var(--card2)] px-3 py-1.5 text-sm text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--border)] disabled:hover:text-[var(--text)]';

  return (
    <div className="flex items-center justify-center gap-3">
      <button type="button" onClick={onPrev} aria-label="Previous period" className={buttonClass}>
        {compact ? '←' : '← Prev'}
      </button>
      <span className={cn('text-center text-sm text-[var(--muted)]', compact ? 'min-w-[150px]' : 'min-w-[160px]')}>
        {label}
      </span>
      <button type="button" onClick={onNext} disabled={isCurrent} aria-label="Next period" className={buttonClass}>
        {compact ? '→' : 'Next →'}
      </button>
    </div>
  );
}

/**
 * Segmented range picker for the weight charts ("4W / 8W / 12W / All"). A row of chips rather
 * than the prev/next stepper above: these are window widths, not successive periods, so stepping
 * through them one at a time would be the wrong gesture.
 */
export function RangeChips<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex items-center gap-1">
      {options.map(option => {
        const selected = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.key)}
            className={cn(
              'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
              selected
                ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                : 'text-[var(--subtle)] hover:bg-[var(--card2)] hover:text-[var(--text)]',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function FieldCard({
  label,
  error,
  children,
}: {
  label: string;
  /** Validation message for the field. Renders red and marks the border, so a rejected value says why. */
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        'block cursor-default rounded-[10px] border bg-[var(--card2)] px-3 py-2.5',
        error ? 'border-[var(--red)]' : 'border-[var(--border)]',
      )}
    >
      <span className="mb-[3px] block text-[9px] uppercase tracking-[0.07em] text-[var(--subtle)]">{label}</span>
      {children}
      {error && <span className="mt-1 block text-[10px] text-[var(--red)]">{error}</span>}
    </label>
  );
}
