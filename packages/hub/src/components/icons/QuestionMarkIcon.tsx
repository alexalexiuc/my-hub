import { cn } from '@/lib/utils';
import { IconProps } from './types';

export function QuestionMarkIcon({ className }: IconProps = {}) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={cn('size-4', className)} aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 2a8 8 0 1 0 0 16A8 8 0 0 0 10 2Zm0 13a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm1-4.5V11a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1c.83 0 1.5-.67 1.5-1.5S10.83 6 10 6 8.5 6.67 8.5 7.5a1 1 0 0 1-2 0C6.5 5.57 8.07 4 10 4s3.5 1.57 3.5 3.5c0 1.54-.99 2.85-2.5 3.32V10.5a1 1 0 0 1-1 0Z"
      />
    </svg>
  );
}
