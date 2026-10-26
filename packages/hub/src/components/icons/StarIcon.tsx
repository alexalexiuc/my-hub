import { cn } from '@/lib/utils';
import { IconProps } from './types';

/** A five-point star; `filled` draws it solid (pinned), otherwise as an outline. */
export function StarIcon({ className, filled = false }: IconProps & { filled?: boolean } = {}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinejoin="round"
      className={cn('size-4', className)}
      aria-hidden="true"
    >
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5z" />
    </svg>
  );
}
