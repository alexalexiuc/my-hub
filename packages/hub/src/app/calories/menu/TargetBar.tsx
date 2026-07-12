type TargetBarProps = {
  /** Planned kcal as a percentage of target (from `targetPct`); null renders an empty bar. */
  pct: number | null;
  /** Fill color pair from `targetColorClasses` — kept as a prop so the caller owns the palette. */
  colors: { text: string; bg: string };
  /** Bar thickness — `sm` (4px) for the per-day bar, `md` (6px) for the weekly summary bar. */
  size?: 'sm' | 'md';
};

/** Thin rounded progress bar shared by DayCard's per-day target bar and MenuDetail's weekly summary. */
export function TargetBar({ pct, colors, size = 'sm' }: TargetBarProps) {
  return (
    <div className={`${size === 'sm' ? 'h-1' : 'h-1.5'} rounded-full bg-[var(--card3)]`}>
      <div
        className={`h-full rounded-full transition-all duration-500 ${colors.bg}`}
        style={{ width: `${Math.min(pct ?? 0, 100)}%` }}
      />
    </div>
  );
}
