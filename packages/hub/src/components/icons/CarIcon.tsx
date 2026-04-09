import { cn } from '@/lib/utils';
import { IconProps } from './types';

export function CarIcon({ className }: IconProps = {}) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={cn('size-4', className)} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M5.404 4.21A2 2 0 017.341 3h5.318a2 2 0 011.937 1.21L16 7h.5A1.5 1.5 0 0118 8.5v4a1.5 1.5 0 01-1.5 1.5H16v1a1 1 0 01-1 1h-1a1 1 0 01-1-1v-1H7v1a1 1 0 01-1 1H5a1 1 0 01-1-1v-1h-.5A1.5 1.5 0 012 12.5v-4A1.5 1.5 0 013.5 7H4l1.404-2.79zM6.28 7h7.44l-.97-1.934A.5.5 0 0012.26 4.75H7.741a.5.5 0 00-.49.316L6.28 7zM5.5 10a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2z"
        clipRule="evenodd"
      />
    </svg>
  );
}
