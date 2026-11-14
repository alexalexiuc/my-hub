import { cn } from '@/lib/utils';
import { rangeBarPositions } from './menu.utils';

type RangeBarProps = {
  plannedKcal: number;
  /** The range's floor; null leaves out its tick. */
  floor: number | null;
  ceiling: number;
  /** Fill colour — a CSS colour, from `dayStatusColor`. */
  color: string;
  size?: 'sm' | 'md';
};

/**
 * A progress bar filled up to the planned kcal, with a tick at the range's floor and another at
 * its ceiling — so it reads like every other progress bar, while still showing a minimum that a
 * bar against a single target cannot.
 */
export function RangeBar({ plannedKcal, floor, ceiling, color, size = 'sm' }: RangeBarProps) {
  const { fill, floorTick, ceilingTick } = rangeBarPositions(plannedKcal, floor, ceiling);
  const tick = cn(
    'absolute w-0.5 -translate-x-1/2 rounded-xs bg-[var(--text)]',
    size === 'sm' ? '-top-1 h-3.5' : '-top-1 h-4',
  );
  return (
    <div className={cn('relative rounded-full bg-[var(--card3)]', size === 'sm' ? 'h-1.5' : 'h-2')} aria-hidden="true">
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
        style={{ width: `${fill}%`, backgroundColor: color }}
      />
      {floorTick !== null && <div className={cn(tick, 'opacity-50')} style={{ left: `${floorTick}%` }} />}
      <div className={cn(tick, 'opacity-80')} style={{ left: `${ceilingTick}%` }} />
    </div>
  );
}
