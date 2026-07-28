'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { IconButton } from '@/components/IconButton';
import { ChevronLeftOutlineIcon, ChevronRightOutlineIcon } from '@/components/icons';

export type NavRowProps = {
  /** Omit to hide the prev arrow entirely (e.g. range/all-time modes with no step direction). */
  onPrev?: () => void;
  onNext?: () => void;
  /** Required together with onPrev/onNext — the arrow's accessible label. */
  prevLabel?: string;
  nextLabel?: string;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  /** Main label area — a dropdown button, plain heading, or any custom content. */
  label: React.ReactNode;
  /** Extra content rendered right after the next arrow (e.g. a "Today" pill). */
  afterNext?: React.ReactNode;
  /** Extra content pinned to the trailing end of the row on all breakpoints. */
  trailing?: React.ReactNode;
  /** Absolutely-positioned overlay content (e.g. a dropdown panel) anchored to this row. */
  overlay?: React.ReactNode;
  /**
   * Breaks the row out to a full-bleed strip on mobile (counteracts a page's px-7 padding, adds
   * top/bottom borders), resetting to plain inline on desktop. Off by default — most callers sit
   * inside a card, modal, or list where a page-header-style breakout would look out of place.
   * Turn on for a row used as its own top-of-page header (see DatePicker's default).
   */
  fullBleed?: boolean;
  className?: string;
};

/**
 * Generic prev-arrow / label / next-arrow / trailing row, with an opt-in mobile
 * full-bleed-strip / desktop-inline responsive treatment. Page-agnostic: callers own what the
 * label/trailing content is and how prev/next behave — fixed date-step navigation (see
 * DatePicker) and "jump to the closest existing item, skipping gaps" navigation (see
 * WeekNavigator) both render through this same row.
 */
export const NavRow = forwardRef<HTMLDivElement, NavRowProps>(function NavRow(
  {
    onPrev,
    onNext,
    prevLabel,
    nextLabel,
    prevDisabled,
    nextDisabled,
    label,
    afterNext,
    trailing,
    overlay,
    fullBleed = false,
    className,
  },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'relative flex items-center gap-2',
        fullBleed && [
          // Mobile: full-bleed strip (counteracts layout px-7), top/bottom borders only
          '-mx-7 border-y border-[var(--border)] bg-[var(--card2)] px-7 py-2.5',
          // Desktop: reset to inline
          'md:mx-0 md:border-0 md:bg-transparent md:p-0',
        ],
        className,
      )}
    >
      {onPrev && (
        <IconButton
          label={prevLabel ?? 'Previous'}
          icon={<ChevronLeftOutlineIcon />}
          onClick={onPrev}
          disabled={prevDisabled}
          className="bg-transparent text-[var(--muted)] hover:bg-transparent hover:text-[var(--text)] disabled:opacity-30"
        />
      )}

      {label}

      {onNext && (
        <IconButton
          label={nextLabel ?? 'Next'}
          icon={<ChevronRightOutlineIcon />}
          onClick={onNext}
          disabled={nextDisabled}
          className="bg-transparent text-[var(--muted)] hover:bg-transparent hover:text-[var(--text)] disabled:opacity-30"
        />
      )}

      {afterNext}

      {trailing != null && <div className="ml-auto shrink-0">{trailing}</div>}

      {overlay}
    </div>
  );
});
