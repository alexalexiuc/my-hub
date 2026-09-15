'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/Button';
import { NavRow } from '@/components/NavRow';

export type YearNavProps = {
  year: number;
  onChange: (year: number) => void;
  /** Disables the back arrow once `year` reaches this value. */
  minYear?: number;
  /** Disables the forward arrow once `year` reaches this value. */
  maxYear?: number;
  /** Shows a "This year" pill whenever the displayed year differs from this value. */
  currentYear?: number;
  /** Extra content pinned to the trailing end of the row. */
  trailing?: React.ReactNode;
  /** Full-bleed mobile strip treatment — see NavRow. Off by default. */
  fullBleed?: boolean;
  className?: string;
};

/**
 * Year carousel: back arrow / year / forward arrow, rendered through the shared `NavRow` so it
 * matches `DatePicker`'s month carousel. Page-agnostic — the caller owns what the year selects.
 */
export function YearNav({
  year,
  onChange,
  minYear,
  maxYear,
  currentYear,
  trailing,
  fullBleed = false,
  className,
}: YearNavProps) {
  return (
    <NavRow
      onPrev={() => onChange(year - 1)}
      onNext={() => onChange(year + 1)}
      prevLabel="Previous year"
      nextLabel="Next year"
      prevDisabled={minYear !== undefined && year <= minYear}
      nextDisabled={maxYear !== undefined && year >= maxYear}
      label={
        <h2
          className={cn(
            'text-center font-bold tracking-tight text-[var(--text)] tabular-nums',
            'flex-1 text-[32px] leading-none',
            'md:flex-none md:w-24 md:text-[22px] md:leading-normal',
          )}
        >
          {year}
        </h2>
      }
      afterNext={
        currentYear !== undefined &&
        year !== currentYear && (
          <Button variant="fin-pill" size="xs" onClick={() => onChange(currentYear)}>
            This year
          </Button>
        )
      }
      trailing={trailing}
      fullBleed={fullBleed}
      className={className}
    />
  );
}
