import { cn } from '@/lib/utils';
import { IconProps } from './types';

export function PencilIcon({ className }: IconProps = {}) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={cn('size-4', className)} aria-hidden="true">
      <path d="M14.69 2.86a2 2 0 0 1 2.83 2.83l-8.4 8.4a1 1 0 0 1-.46.26l-3.4.85a.5.5 0 0 1-.61-.61l.85-3.4a1 1 0 0 1 .26-.46l8.4-8.4Zm1.41 1.42a1 1 0 0 0-1.41 0l-.88.88 1.41 1.41.88-.88a1 1 0 0 0 0-1.41ZM6.46 11.1l-.52 2.08 2.08-.52 6.68-6.68-1.41-1.41-6.68 6.68Z" />
    </svg>
  );
}
