import { cn } from '@/lib/utils';
import { IconProps } from './types';

export function AnimatedCheckIcon({ className }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn('size-5', className)} aria-hidden="true">
      <circle cx="12" cy="12" r="11" className="stroke-current opacity-30" strokeWidth="1.5" />
      <polyline
        points="7 12.5 10.5 16 17 8"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1}
        className="animate-[checkDraw_380ms_ease-out_100ms_forwards]"
      />
    </svg>
  );
}
