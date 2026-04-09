import { cn } from '@/lib/utils';
import { IconProps } from './types';

export function CarKeyIcon({ className }: IconProps = {}) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={cn('size-4', className)} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M6.5 3A3.5 3.5 0 003 6.5a3.5 3.5 0 002.392 3.322l-.878.878a1 1 0 000 1.414l.586.586-1.1 1.1v1.7h1.7l1.1-1.1.586.586a1 1 0 001.414 0l.878-.878A3.5 3.5 0 0010 6.5 3.5 3.5 0 006.5 3zM6 5.5a1 1 0 112 0 1 1 0 01-2 0z"
        clipRule="evenodd"
      />
      <path d="M12 7h5a2 2 0 012 2v2a2 2 0 01-2 2h-1v-1.5a.5.5 0 00-.5-.5h-1a.5.5 0 00-.5.5V13h-1v-1.5a.5.5 0 00-.5-.5h-1a.5.5 0 00-.5.5V13h-.5a1 1 0 01-1-1V8a1 1 0 011-1z" />
    </svg>
  );
}
