import { cn } from '@/lib/utils';
import { IconProps } from './types';

export function AttachmentIcon({ className }: IconProps = {}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={cn('size-4', className)}
      aria-hidden="true"
    >
      <path d="M21.44 11.05 12 20.5a5.5 5.5 0 0 1-7.78-7.78l9.55-9.55a3.5 3.5 0 1 1 4.95 4.95L8.9 18a1.5 1.5 0 1 1-2.12-2.12l8.49-8.48" />
    </svg>
  );
}
