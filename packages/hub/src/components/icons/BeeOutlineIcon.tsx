import { cn } from '@/lib/utils';
import { IconProps } from './types';

export function BeeOutlineIcon({ className }: IconProps = {}) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-4', className)}
      aria-hidden="true"
    >
      <line x1="27" y1="10" x2="20" y2="3" />
      <circle cx="19" cy="2.5" r="2" fill="currentColor" stroke="none" />
      <line x1="37" y1="10" x2="44" y2="3" />
      <circle cx="45" cy="2.5" r="2" fill="currentColor" stroke="none" />
      <circle cx="32" cy="14" r="5" />
      <ellipse cx="32" cy="34" rx="10" ry="14" />
      <line x1="22" y1="28" x2="42" y2="28" />
      <line x1="22" y1="35" x2="42" y2="35" />
      <line x1="23" y1="42" x2="41" y2="42" />
      <path d="M22 28 Q6 36 8 48 Q16 50 22 36" />
      <path d="M42 28 Q58 36 56 48 Q48 50 42 36" />
    </svg>
  );
}
