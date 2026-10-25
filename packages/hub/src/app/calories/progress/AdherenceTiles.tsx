import { Card, ProgressBar } from '@/components';
import type { TargetAdherenceSummary } from '@my-hub/shared/utils';
import { MACRO_COLORS } from '../constants';

type AdherenceTilesProps = {
  summary: TargetAdherenceSummary;
  /** The month's base (non-gym-day) target, for the average's comparison line. */
  baseTarget: number | null;
  /** The current streak only means something while the month is still running. */
  isCurrentMonth: boolean;
};

function Tile({ label, children, footer }: { label: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-1 p-3.5" compact>
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">{label}</span>
      <div className="text-2xl font-bold leading-tight text-[var(--text)]">{children}</div>
      {footer && <div className="text-[11px] text-[var(--subtle)]">{footer}</div>}
    </Card>
  );
}

/**
 * The month in four numbers — so the grid's colours don't have to be counted by eye to know how
 * it went: days on target, streak, average intake, days the protein goal was hit.
 */
export function AdherenceTiles({ summary, baseTarget, isCurrentMonth }: AdherenceTilesProps) {
  const { loggedDays, onTargetDays, currentStreak, bestStreak, avgKcal, proteinHitDays } = summary;
  const unit = <span className="text-sm font-medium text-[var(--muted)]"> / {loggedDays} days</span>;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Tile
        label="On target"
        footer={
          loggedDays > 0 ? (
            <ProgressBar value={onTargetDays} max={loggedDays} thresholds={false} color="var(--green)" height={5} />
          ) : (
            'No finished days logged yet'
          )
        }
      >
        <span className="text-[var(--green)]">{onTargetDays}</span>
        {unit}
      </Tile>

      <Tile label="Streak" footer={isCurrentMonth ? `Best this month: ${bestStreak}` : 'Longest run this month'}>
        {isCurrentMonth ? currentStreak : bestStreak}
        <span className="text-sm font-medium text-[var(--muted)]">
          {' '}
          {(isCurrentMonth ? currentStreak : bestStreak) === 1 ? 'day' : 'days'}
        </span>
      </Tile>

      <Tile
        label="Avg intake"
        footer={
          avgKcal !== null && baseTarget !== null
            ? `${avgKcal - baseTarget >= 0 ? '+' : '−'}${Math.abs(avgKcal - baseTarget).toLocaleString()} vs base target ${baseTarget.toLocaleString()}`
            : undefined
        }
      >
        {avgKcal !== null ? avgKcal.toLocaleString() : '—'}
        <span className="text-sm font-medium text-[var(--muted)]"> kcal</span>
      </Tile>

      <Tile label="Protein hit" footer={proteinHitDays === null ? 'Set a protein goal in Settings' : undefined}>
        {proteinHitDays === null ? (
          '—'
        ) : (
          <>
            <span style={{ color: MACRO_COLORS.protein }}>{proteinHitDays}</span>
            {unit}
          </>
        )}
      </Tile>
    </div>
  );
}
