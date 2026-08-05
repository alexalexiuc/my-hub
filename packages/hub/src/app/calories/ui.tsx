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
