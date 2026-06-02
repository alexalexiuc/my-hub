'use client';

import { cn } from '@/lib/utils';

type ProgressBarProps = {
  value: number;
  max: number;
  /** Base color; overridden by threshold logic when `thresholds` is true. */
  color?: string;
  /** Bar height in px. Default 6. */
  height?: number;
  /** When true (default), auto-colors amber at ≥80% and red at ≥100%. */
  thresholds?: boolean;
  className?: string;
};

/** Progress bar with optional threshold-based color feedback (amber ≥80%, red ≥100%). */
export function ProgressBar({ value, max, color, height = 6, thresholds = true, className }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const barColor = thresholds
    ? pct >= 100
      ? 'var(--red)'
      : pct >= 80
        ? 'var(--amber)'
        : (color ?? 'var(--green)')
    : (color ?? 'var(--green)');
  return (
    <div
      className={cn('overflow-hidden', className)}
      style={{ height, borderRadius: height / 2, background: 'var(--card2)' }}
    >
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          borderRadius: height / 2,
          background: barColor,
          transition: 'width .4s ease',
        }}
      />
    </div>
  );
}
