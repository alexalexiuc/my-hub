import { cn } from '@/lib/utils';
import { IconProps } from './types';

export function MapFlagIcon({ className }: IconProps = {}) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={cn('size-4', className)} aria-hidden="true">
      <path d="M3 3a1 1 0 011-1h.5a.5.5 0 01.354.146L7.707 5H16a1 1 0 01.8 1.6L14.25 10l2.55 3.4A1 1 0 0116 15H7.707l-2.853 2.854A.5.5 0 014.5 18H4a1 1 0 01-1-1V3z" />
    </svg>
  );
}
