import { cn } from '@/lib/utils';
import { IconProps } from './types';

export function TrainIcon({ className }: IconProps = {}) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={cn('size-4', className)} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M6 2a3 3 0 00-3 3v8a3 3 0 003 3l-1.5 2h1.833L7.5 16h5l1.167 2H15.5L14 16a3 3 0 003-3V5a3 3 0 00-3-3H6zm0 2h8a1 1 0 011 1v3H5V5a1 1 0 011-1zm-1 7a1 1 0 011-1h1a1 1 0 110 2H6a1 1 0 01-1-1zm7-1a1 1 0 100 2h1a1 1 0 100-2h-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}
