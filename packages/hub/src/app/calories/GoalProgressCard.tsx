'use client';

import { useMemo, useState } from 'react';
import { ComposedChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import type { TooltipContentProps, TooltipPayloadEntry } from 'recharts';
import { Card, ProgressBar } from '@/components';
import { GoalTypes } from '@my-hub/shared/constants';
import { isAheadOfGoal } from '@my-hub/shared/utils';
import { buildGoalProgressView, formatEtaDate, type GoalProgressView, type WeightPoint } from './calories.utils';
import { DEFAULT_GOAL_RANGE, GOAL_RANGE_KEYS, WEIGHT_RANGE_OPTIONS, type WeightRangeKey } from './constants';
import { RangeChips } from './ui';

type GoalProgressCardProps = {
  weightHistory: WeightPoint[];
  goalType: string | null;
  goalWeeklyRateKg: number | null;
  /** The stored goal baseline. Absent fields fall back to an inferred anchor, flagged in the UI. */
  goalStartDate: string | null;
  goalStartWeightKg: number | null;
  /** Optional finish line. Without it the card shows the rate only, with no journey bar or ETA. */
  goalTargetWeightKg: number | null;
  /** Stamps a fresh baseline at today's trend weight. */
  onResetBaseline: () => void;
  canReset: boolean;
};

const SERIES_LABELS: Record<string, string> = {
  trend: 'Trend',
  actual: 'Weigh-in',
  projected: 'Goal',
};

const fmtKg = (value: number) => `${value.toFixed(1)} kg`;
const fmtRate = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)} kg/wk`;
const fmtSignedKg = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)} kg`;

function CustomTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;
  const date = (payload[0] as { payload?: { date?: string } })?.payload?.date ?? label;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card2)] px-3 py-2 text-[13px] text-[var(--text)]">
      <p className="mb-1 text-[var(--muted)]">{String(date)}</p>
      {payload.map((entry: TooltipPayloadEntry) => (
        <p key={entry.name as string} className="mb-0.5" style={{ color: (entry.color as string) ?? 'var(--text)' }}>
          {SERIES_LABELS[entry.name as string] ?? (entry.name as string)}:{' '}
          <strong>{entry.value != null ? fmtKg(entry.value as number) : '—'}</strong>
        </p>
      ))}
    </div>
  );
}

/**
 * How the current position reads against the goal line, as text plus the colour to say it in.
 * Kept separate from the chart maths because it is purely how the number is phrased.
 */
function summariseDelta(goalType: string | null, deltaKg: number): { text: string; color: string } {
  if (Math.abs(deltaKg) < 0.1) return { text: 'On track', color: 'text-[var(--muted)]' };

  const ahead = isAheadOfGoal(goalType, deltaKg);
  if (ahead === null) {
    return {
      text: deltaKg > 0 ? `${fmtKg(deltaKg)} above target` : `${fmtKg(Math.abs(deltaKg))} below target`,
      color: 'text-[var(--amber)]',
    };
  }

  const noun = goalType === GoalTypes.WeightLoss ? 'loss' : 'gain';
  return {
    text: `${fmtKg(Math.abs(deltaKg))} ${ahead ? 'ahead of' : 'behind'} ${noun} goal`,
    color: ahead ? 'text-[var(--green)]' : 'text-[var(--red)]',
  };
}

/** The y-domain, padded so the lines never touch the frame. */
function chartDomain(view: GoalProgressView): [number, number] {
  const values = view.points.flatMap(p => [p.actual, p.trend, p.projected]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 0.4);
  return [Math.floor((min - range * 0.15) * 10) / 10, Math.ceil((max + range * 0.15) * 10) / 10];
}

export function GoalProgressCard({
  weightHistory,
  goalType,
  goalWeeklyRateKg,
  goalStartDate,
  goalStartWeightKg,
  goalTargetWeightKg,
  onResetBaseline,
  canReset,
}: GoalProgressCardProps) {
  const [range, setRange] = useState<WeightRangeKey>(DEFAULT_GOAL_RANGE);

  const rangeOptions = useMemo(() => WEIGHT_RANGE_OPTIONS.filter(option => GOAL_RANGE_KEYS.includes(option.key)), []);

  const view = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const days = WEIGHT_RANGE_OPTIONS.find(o => o.key === range)?.days ?? null;
    const windowStart =
      days === null
        ? (goalStartDate ?? '0000-01-01')
        : new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

    return buildGoalProgressView({
      weightHistory,
      profile: { goalStartDate, goalStartWeightKg },
      goalType,
      goalWeeklyRateKg,
      goalTargetWeightKg,
      windowStart,
      today,
    });
  }, [weightHistory, goalType, goalWeeklyRateKg, goalTargetWeightKg, goalStartDate, goalStartWeightKg, range]);

  if (!goalType) return null;

  const header = (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">Goal progress</h2>
      <RangeChips options={rangeOptions} value={range} onChange={setRange} ariaLabel="Goal progress range" />
    </div>
  );

  if (!view) {
    return (
      <Card className="p-5">
        {header}
        <p className="text-xs text-[var(--subtle)]">
          {goalWeeklyRateKg ? 'No weigh-ins in this range yet.' : 'Set a weekly goal rate to track progress.'}
        </p>
      </Card>
    );
  }

  const summary = summariseDelta(goalType, view.deltaKg);
  const domain = chartDomain(view);
  const showDots = view.points.length <= 40;
  // Sized from the formatted tick, decimal included: the domain is rounded to 0.1, so ticks read
  // "91.9", not "92", and measuring the integer part alone clipped the leading digit off every one.
  const axisWidth = Math.max(40, domain[1].toFixed(1).length * 8 + 14);

  return (
    <Card className="p-5">
      {header}

      <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-sm text-[var(--muted)]">
          {/* "on plan" rather than "target": with a goal weight set, "target" would be ambiguous
              between where the line sits today and the finish line itself. */}
          <span className="font-semibold text-[var(--text)]">{fmtKg(view.currentTrendKg)}</span> trend /{' '}
          {fmtKg(view.projectedTodayKg)} on plan
        </span>
        <span className={`text-xs font-medium ${summary.color}`}>{summary.text}</span>
      </div>

      {view.journey && (
        <div className="mb-2 mt-2">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 text-[11px]">
            <span className="text-[var(--muted)]">
              {fmtKg(Math.abs(view.journey.changedKg))} of {fmtKg(Math.abs(view.journey.totalKg))} to goal
            </span>
            <span className="text-[var(--subtle)]">
              {fmtKg(Math.abs(view.journey.remainingKg))} to go · {Math.round(view.journey.pct)}%
            </span>
          </div>
          {/* Thresholds off: they turn a bar amber at 80% and red at 100%, which is the opposite of
              what nearly reaching a goal weight means. */}
          <ProgressBar value={view.journey.pct} max={100} thresholds={false} color="var(--accent)" height={5} />
        </div>
      )}

      <p className="mb-3 text-[11px] text-[var(--subtle)]">
        {fmtKg(view.currentActualKg)} last weigh-in ·{' '}
        {view.actualRateKgPerWeek !== null
          ? `${fmtRate(view.actualRateKgPerWeek)} actual vs ${fmtRate(view.goalRateKgPerWeek)} goal`
          : `goal ${fmtRate(view.goalRateKgPerWeek)}`}
        {view.weeklyChangeKg !== null && ` · ${fmtSignedKg(view.weeklyChangeKg)} this week`} ·{' '}
        {fmtSignedKg(view.totalChangeKg)} since {view.anchor.date}
      </p>

      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={view.points} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--subtle)', fontSize: 11 }} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--subtle)', fontSize: 11 }}
              domain={domain}
              width={axisWidth}
            />
            <RechartsTooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              content={props => (
                <CustomTooltip
                  active={props.active}
                  payload={props.payload}
                  label={props.label}
                  coordinate={props.coordinate}
                  accessibilityLayer={props.accessibilityLayer}
                  activeIndex={props.activeIndex}
                />
              )}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: 'var(--muted)', paddingTop: 4 }}
              formatter={value => SERIES_LABELS[value as string] ?? value}
            />
            {/* Raw weigh-ins, deliberately faint: they are context for the trend, not the verdict. */}
            <Line
              dataKey="actual"
              name="actual"
              type="monotone"
              stroke="var(--subtle)"
              strokeWidth={1}
              strokeOpacity={0.55}
              dot={showDots ? { fill: 'var(--subtle)', r: 2, strokeWidth: 0 } : false}
              activeDot={{ r: 4, fill: 'var(--subtle)' }}
              connectNulls
            />
            <Line
              dataKey="trend"
              name="trend"
              type="monotone"
              stroke="var(--accent)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: 'var(--accent)' }}
              connectNulls
            />
            <Line
              dataKey="projected"
              name="projected"
              type="monotone"
              stroke="var(--amber)"
              strokeWidth={1.5}
              strokeDasharray="6 3"
              dot={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--subtle)]">
        <span>
          {view.anchor.source === 'inferred'
            ? `Baseline estimated from your earliest weigh-in (${view.anchor.date}).`
            : `Goal started ${view.anchor.date} at ${fmtKg(view.anchor.weightKg)}.`}
          {/* The plan's own date is shown alongside, because the gap between the two is the point:
              it says how much the achieved rate is costing in time. */}
          {view.etaAtActualRate && ` At this rate you reach it ${formatEtaDate(view.etaAtActualRate)}`}
          {view.etaAtActualRate && view.etaAtGoalRate && ` (plan: ${formatEtaDate(view.etaAtGoalRate)})`}
          {view.etaAtActualRate && '.'}
          {!view.etaAtActualRate && view.journey && ' Not currently moving towards the goal weight.'}
        </span>
        {canReset && (
          <button
            type="button"
            onClick={onResetBaseline}
            className="rounded-md border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Restart from today
          </button>
        )}
      </div>
    </Card>
  );
}
