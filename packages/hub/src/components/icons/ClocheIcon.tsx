import { cn } from '@/lib/utils';
import { IconProps } from './types';

/** A covered serving dish (dome lid over a plate) — used to mark a day that has a planned meal. */
export function ClocheIcon({ className }: IconProps = {}) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={cn('size-4', className)} aria-hidden="true">
      <circle cx="10" cy="3.5" r="1.25" />
      <path d="M3 11a7 7 0 0114 0H3z" />
      <rect x="2" y="12" width="16" height="2" rx="1" />
    </svg>
  );
}
