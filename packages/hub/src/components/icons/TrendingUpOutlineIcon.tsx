import { cn } from '@/lib/utils';
import { IconProps } from './types';

export function TrendingUpOutlineIcon({ className }: IconProps = {}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-4', className)}
      aria-hidden="true"
    >
      <path d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22" />
      <path d="m16.5 8.818 5.94 2.28-2.28 5.941" />
    </svg>
  );
}
