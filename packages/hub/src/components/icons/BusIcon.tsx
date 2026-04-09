import { cn } from '@/lib/utils';
import { IconProps } from './types';

export function BusIcon({ className }: IconProps = {}) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={cn('size-4', className)} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M5 2a3 3 0 00-3 3v8a3 3 0 003 3v1a1 1 0 001 1h1a1 1 0 001-1v-1h4v1a1 1 0 001 1h1a1 1 0 001-1v-1a3 3 0 003-3V5a3 3 0 00-3-3H5zm0 2h10a1 1 0 011 1v3H4V5a1 1 0 011-1zM4 10h5v3H5a1 1 0 01-1-1v-2zm7 0h5v2a1 1 0 01-1 1h-4v-3zm-5 4.5a1 1 0 100-2 1 1 0 000 2zm9-1a1 1 0 11-2 0 1 1 0 012 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}
