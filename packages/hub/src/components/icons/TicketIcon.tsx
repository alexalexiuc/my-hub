import { cn } from '@/lib/utils';
import { IconProps } from './types';

export function TicketIcon({ className }: IconProps = {}) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={cn('size-4', className)} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M2 6a2 2 0 012-2h12a2 2 0 012 2v1.5a.5.5 0 01-.5.5 1.5 1.5 0 000 3 .5.5 0 01.5.5V14a2 2 0 01-2 2H4a2 2 0 01-2-2v-2.5a.5.5 0 01.5-.5 1.5 1.5 0 000-3 .5.5 0 01-.5-.5V6zm11.5 1a.5.5 0 00-1 0v1a.5.5 0 001 0V7zm0 2.5a.5.5 0 00-1 0v1a.5.5 0 001 0v-1zm0 2.5a.5.5 0 00-1 0v1a.5.5 0 001 0v-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}
