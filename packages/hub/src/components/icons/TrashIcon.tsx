import { cn } from '@/lib/utils';
import { IconProps } from './types';

export function TrashIcon({ className }: IconProps = {}) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={cn('size-4', className)} aria-hidden="true">
      <path d="M7.5 3a1 1 0 0 0-1 1v1H4a.5.5 0 0 0 0 1h.54l.72 9.07A2 2 0 0 0 7.26 17h5.48a2 2 0 0 0 1.99-1.93L15.46 6H16a.5.5 0 0 0 0-1h-2.5V4a1 1 0 0 0-1-1h-5Zm1 2V4h3v1h-3Zm-1.96 1 .71 8.93a1 1 0 0 0 1 .97h5.5a1 1 0 0 0 1-.97L15.46 6H6.54Z" />
    </svg>
  );
}
