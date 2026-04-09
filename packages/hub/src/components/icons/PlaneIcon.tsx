import { cn } from '@/lib/utils';
import { IconProps } from './types';

export function PlaneIcon({ className }: IconProps = {}) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={cn('size-4', className)} aria-hidden="true">
      <path d="M17.707 3.293a1 1 0 00-1.414 0l-3.5 3.5-4.586-.764a1 1 0 00-.914.281L5.586 8.017l3.91 1.956-3.789 3.789-1.414-.707a1 1 0 00-1.186.186l-.814.814a.5.5 0 00.146.793l2.707 1.354 1.354 2.707a.5.5 0 00.793.146l.814-.814a1 1 0 00.186-1.186l-.707-1.414 3.789-3.789 1.956 3.91 1.707-1.707a1 1 0 00.281-.914l-.764-4.586 3.5-3.5a1 1 0 000-1.414l-.146-.146z" />
    </svg>
  );
}
