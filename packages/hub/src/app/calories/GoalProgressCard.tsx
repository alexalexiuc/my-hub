'use client';

import { ComposedChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { Card } from '@/components';
import type { TooltipContentProps, TooltipPayloadEntry } from 'recharts';
import { GoalTypes } from '@my-hub/shared/constants';

interface DayData {
  date: string;
  label: string;
}

interface WeightMeasurement {
  date: string;
  value: number;
}

type GoalProgressCardProps = {
  days: DayData[];
  weightHistory: WeightMeasurement[];
  goalType: string | null;
  goalWeeklyRateKg: number | null;
};

function CustomTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;
  const date = (payload[0] as { payload?: { date?: string } })?.payload?.date ?? label;

  return (
    <div
      style={{
        background: 'var(--card2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 13,
        color: 'var(--text)',
      }}
    >
      <p style={{ color: 'var(--muted)', marginBottom: 4 }}>{String(date)}</p>
      {payload.map((entry: TooltipPayloadEntry) => (
        <p
          key={entry.name as string}
          style={{ color: (entry.color as string | undefined) ?? 'var(--text)', marginBottom: 2 }}
        >
          {entry.name === 'actual' ? 'Actual' : 'Projected'}:{' '}
          <strong>{entry.value != null ? `${(entry.value as number).toFixed(1)} kg` : '—'}</strong>
        </p>
      ))}
    </div>
  );
}

/**
 * Calculates the daily weight change needed to meet the weekly goal, based on the goal type and weekly rate.
 * Returns null if inputs are invalid or insufficient to determine a daily delta.
 */
function getDailyGoalDelta(goalType: string | null, goalWeeklyRateKg: number | null): number | null {
  if (goalType === GoalTypes.Maintain) return 0;
  if (!goalWeeklyRateKg || goalWeeklyRateKg <= 0) return null;
  if (goalType === GoalTypes.WeightLoss) return -(goalWeeklyRateKg / 7);
  if (goalType === GoalTypes.WeightGain) return goalWeeklyRateKg / 7;
  return null;
}

/**
 * Returns the baseline weight for the week, which is ideally the Monday weight. If Monday's weight is not available, falls back to the most recent known weight before that week. Returns null if no weight data is available at all.
 */
function getBaselineWeightForWeek(weightRows: WeightMeasurement[], weekStartDate: string): number | null {
  const mondayWeightOrLast =
    weightRows.find(row => row.date === weekStartDate || row.date < weekStartDate)?.value ?? null;
  if (mondayWeightOrLast !== null) return mondayWeightOrLast;
  return weightRows[0]?.value ?? null;
}

/**
 * Finds the weight for the given date. If `nearestIfNone` is true and there's no exact match, returns the most recent past weight.
 */
function findPastWeight(weightRows: WeightMeasurement[], date: string, nearestIfNone: boolean = false): number | null {
  for (const row of weightRows) {
    if (nearestIfNone && row.date <= date) return row.value;
    if (row.date === date) return row.value;
  }
  return null;
}

export function GoalProgressCard({ days, weightHistory, goalType, goalWeeklyRateKg }: GoalProgressCardProps) {
  if (days.length === 0 || !goalType) return null;

  const dailyDelta = getDailyGoalDelta(goalType, goalWeeklyRateKg);
  if (dailyDelta === null) return null;

  const orderedWeights = [...weightHistory].sort((a, b) => b.date.localeCompare(a.date));
  const weekStart = days[0]!.date;
  const baselineWeight = getBaselineWeightForWeek(orderedWeights, weekStart);
  if (baselineWeight === null) {
    return <p className="px-1 text-xs text-[var(--subtle)]">Weekly goal progress — no recent weight data available.</p>;
  }

  const today = new Date().toISOString().split('T')[0] ?? '';

  const chartData = days.map(({ date, label }, index) => {
    const projected = baselineWeight + dailyDelta * index;
    const isFirstDay = index === 0;
    const actual = date <= today ? findPastWeight(orderedWeights, date, isFirstDay) : null;
    return { date, label, actual, projected };
  });

  const lastPastIndex = days.reduce((idx, d, i) => (d.date <= today ? i : idx), -1);
  const lastPastPoint = lastPastIndex >= 0 ? chartData[lastPastIndex] : null;
  const delta =
    lastPastPoint && lastPastPoint.actual !== null ? (lastPastPoint.actual as number) - lastPastPoint.projected : null;

  const values = chartData.flatMap(d => [d.projected, d.actual ?? d.projected]);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = Math.max(maxVal - minVal, 0.4);
  const minDisplayValue = Math.floor((minVal - range * 0.2) * 10) / 10;
  const maxDisplayValue = Math.ceil((maxVal + range * 0.2) * 10) / 10;
  const numDigits = String(maxDisplayValue).length;
  const yAxisWidth = numDigits >= 5 ? 56 : 46;
  const leftMargin = numDigits >= 5 ? -6 : -16;

  let summaryColor = 'text-[var(--muted)]';
  let summaryText = 'No weight data yet';
  if (delta !== null) {
    if (Math.abs(delta) < 0.1) {
      summaryText = 'On track';
    } else if (goalType === GoalTypes.WeightLoss) {
      const ahead = delta < 0;
      summaryColor = ahead ? 'text-[var(--green)]' : 'text-[var(--red)]';
      summaryText = ahead
        ? `${Math.abs(delta).toFixed(1)} kg ahead of loss goal`
        : `${delta.toFixed(1)} kg behind loss goal`;
    } else if (goalType === GoalTypes.WeightGain) {
      const ahead = delta > 0;
      summaryColor = ahead ? 'text-[var(--green)]' : 'text-[var(--red)]';
      summaryText = ahead
        ? `${delta.toFixed(1)} kg ahead of gain goal`
        : `${Math.abs(delta).toFixed(1)} kg behind gain goal`;
    } else {
      summaryColor = 'text-[var(--amber)]';
      summaryText =
        delta > 0
          ? `${delta.toFixed(1)} kg above maintain target`
          : `${Math.abs(delta).toFixed(1)} kg below maintain target`;
    }
  }

  const actualNow = lastPastPoint?.actual ?? null;
  const projectedNow = lastPastPoint?.projected ?? null;

  return (
    <Card className="p-5">
      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
        Weekly goal progress
      </h2>
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-sm text-[var(--muted)]">
          <span className="font-semibold text-[var(--text)]">
            {actualNow !== null ? `${(actualNow as number).toFixed(1)} kg` : '—'}
          </span>{' '}
          / {projectedNow !== null ? `${(projectedNow as number).toFixed(1)} kg` : '—'} projected
        </span>
        {lastPastIndex >= 0 && <span className={`text-xs font-medium ${summaryColor}`}>{summaryText}</span>}
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: leftMargin }}>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--subtle)', fontSize: 12 }} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--subtle)', fontSize: 11 }}
              domain={[minDisplayValue, maxDisplayValue]}
              width={yAxisWidth}
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
              formatter={value => (value === 'actual' ? 'Actual' : 'Projected')}
            />
            <Line
              dataKey="actual"
              name="actual"
              type="monotone"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={{ fill: 'var(--accent)', r: 3, strokeWidth: 0 }}
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
    </Card>
  );
}
