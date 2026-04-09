import { cn } from '@/lib/utils';
import { IconProps } from './types';

export function UtensilsOutlineIcon({ className }: IconProps = {}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-4', className)}
      aria-hidden="true"
    >
      <path d="M3 2v7c0 1.1.9 2 2 2h1v11h2V11h1a2 2 0 0 0 2-2V2H9v5H7V2H5v5H3V2z" />
      <path d="M19 2v20h-2V13h-1.5C14.1 13 13 11.9 13 10.5V7c0-2.8 2.2-5 5-5z" />
    </svg>
  );
}
