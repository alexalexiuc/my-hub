'use client';

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip as RechartsTooltip,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import { Card } from '@/components';

interface DayData {
  date: string;
  label: string;
  kcal: number;
}

type WeeklyChartProps = {
  data: DayData[];
  target: number | null;
  min?: number | null;
  max?: number | null;
};

function getBarColor(
  kcal: number,
  min: number | null | undefined,
  max: number | null | undefined,
  target: number | null,
): string {
  if (!target && !min && !max) return 'var(--subtle)';
  const ceiling = max ?? target;
  if (ceiling !== null && kcal > ceiling) return 'var(--red)';
  if (min != null && kcal > 0 && kcal < min) return 'var(--accent)';
  if (kcal === 0) return 'var(--border)';
  return 'var(--green)';
}

function CustomTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;
  const kcal = (payload[0]?.value as number | undefined) ?? 0;
  const target = (payload[0] as { payload?: { _target?: number | null } })?.payload?._target ?? null;
  const min = (payload[0] as { payload?: { _min?: number | null } })?.payload?._min ?? null;
  const max = (payload[0] as { payload?: { _max?: number | null } })?.payload?._max ?? null;
  const date = (payload[0] as { payload?: { date?: string } })?.payload?.date ?? label;

  const ceiling = max ?? target;
  const ceilingLabel = max != null ? 'limit' : 'target';
  let deltaLine: string | null = null;
  if (ceiling !== null) {
    const delta = kcal - ceiling;
    if (delta > 0) deltaLine = `+${delta} kcal above ${ceilingLabel}`;
    else if (delta < 0) deltaLine = `${Math.abs(delta)} kcal below ${ceilingLabel}`;
    else deltaLine = `On ${ceilingLabel}`;
  } else if (min != null && kcal < min) {
    deltaLine = `${min - kcal} kcal below min`;
  }

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
      <p style={{ color: 'var(--text)', fontWeight: 600 }}>{kcal} kcal</p>
      {deltaLine && <p style={{ color: 'var(--subtle)', marginTop: 2 }}>{deltaLine}</p>}
    </div>
  );
}

export function WeeklyChart({ data, target, min, max }: WeeklyChartProps) {
  if (data.length === 0) return null;

  const ceiling = max ?? target;
  const lineLabel = max != null ? 'Limit' : 'Target';
  const maxVal = Math.max(...data.map(d => d.kcal), ceiling ?? 0, min ?? 0);
  const maxDisplayValue = Math.ceil(maxVal * 1.15);

  const chartData = data.map(d => ({ ...d, _target: target, _min: min ?? null, _max: max ?? null }));

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">This week</h2>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: -16 }}>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--subtle)', fontSize: 12 }} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--subtle)', fontSize: 11 }}
              domain={[0, maxDisplayValue]}
              width={56}
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
            <Bar dataKey="kcal" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {data.map(entry => (
                <Cell key={entry.date} fill={getBarColor(entry.kcal, min, max, target)} />
              ))}
            </Bar>
            {ceiling != null && (
              <ReferenceLine
                y={ceiling}
                stroke="var(--amber)"
                strokeDasharray="6 3"
                strokeWidth={1.5}
                label={{
                  value: `${lineLabel} ${ceiling}`,
                  position: 'right',
                  fill: 'var(--muted)',
                  fontSize: 11,
                }}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
