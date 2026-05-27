import { cn } from '@/lib/utils';
import { IconProps } from './types';

export function InfoCircleIcon({ className }: IconProps = {}) {
  return (
    <svg viewBox="0 0 8 8" fill="none" className={cn('size-2', className)} aria-hidden="true">
      <circle cx="4" cy="4" r="3.5" stroke="currentColor" />
      <rect x="3.5" y="3.5" width="1" height="2.5" rx="0.5" fill="currentColor" />
      <rect x="3.5" y="2" width="1" height="1" rx="0.5" fill="currentColor" />
    </svg>
  );
}
