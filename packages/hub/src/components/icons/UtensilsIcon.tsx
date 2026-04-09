import { cn } from '@/lib/utils';
import { IconProps } from './types';

export function UtensilsIcon({ className }: IconProps = {}) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={cn('size-4', className)} aria-hidden="true">
      <path d="M7 2a1 1 0 00-1 1v4a2 2 0 001 1.732V17a1 1 0 102 0V8.732A2 2 0 0010 7V3a1 1 0 00-1-1H7zm0 2v3a.5.5 0 001 0V4H7z" />
      <path d="M13 2a1 1 0 00-1 1v5a3 3 0 002 2.83V17a1 1 0 102 0v-6.17A3 3 0 0018 8V3a1 1 0 10-2 0v5a1 1 0 01-1-1V3a1 1 0 00-2 0z" />
    </svg>
  );
}
