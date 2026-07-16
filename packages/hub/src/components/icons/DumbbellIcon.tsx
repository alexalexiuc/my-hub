import { cn } from '@/lib/utils';
import { IconProps } from './types';

export function DumbbellIcon({ className, title }: IconProps & { title?: string } = {}) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-4', className)} aria-hidden="true">
      {title && <title>{title}</title>}
      {/* left weight plate */}
      <rect x="1" y="7" width="5" height="10" rx="1.5" fill="currentColor" stroke="none" />
      {/* bar */}
      <rect x="6" y="10.5" width="12" height="3" rx="1" fill="currentColor" stroke="none" />
      {/* right weight plate */}
      <rect x="18" y="7" width="5" height="10" rx="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
