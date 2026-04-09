import { cn } from '@/lib/utils';
import { IconProps } from './types';

export function DownloadIcon({ className }: IconProps = {}) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={cn('size-4', className)} aria-hidden="true">
      <path d="M10 3a.5.5 0 0 1 .5.5v7.29l2.15-2.14a.5.5 0 0 1 .7.7l-3 3a.5.5 0 0 1-.7 0l-3-3a.5.5 0 1 1 .7-.7L9.5 10.8V3.5A.5.5 0 0 1 10 3Zm-5 11a.5.5 0 0 1 .5.5V16h9v-1.5a.5.5 0 0 1 1 0V16a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-1.5a.5.5 0 0 1 .5-.5Z" />
    </svg>
  );
}
