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
import { intakeBarColor } from './calories.utils';

interface DayData {
  date: string;
  label: string;
  kcal: number;
  /**
   * This day's ceiling. Carried per day rather than once for the week because a gym day's target
   * includes the training bonus — judging every bar against one number marked gym days as over.
   */
  target: number | null;
  /** This day's floor, or null when the profile sets no minimum. */
  min: number | null;
}

type WeeklyChartProps = {
  data: DayData[];
};

function CustomTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;
  const row = (payload[0] as { payload?: DayData })?.payload;
  const kcal = (payload[0]?.value as number | undefined) ?? 0;
  const target = row?.target ?? null;
  const min = row?.min ?? null;
  const date = row?.date ?? label;

  let deltaLine: string | null = null;
  if (target !== null) {
    const delta = kcal - target;
    if (delta > 0) deltaLine = `+${delta} kcal above target`;
    else if (delta < 0) deltaLine = `${Math.abs(delta)} kcal below target`;
    else deltaLine = 'On target';
  } else if (min !== null && kcal < min) {
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

export function WeeklyChart({ data }: WeeklyChartProps) {
  if (data.length === 0) return null;

  // One reference line per distinct target in the week — normally one, two when the week mixes
  // gym and rest days. Drawing only the base target would put every gym-day bar above the line
  // while its bar is correctly coloured on target, which reads as a bug.
  const levels = [...new Set(data.map(d => d.target).filter((t): t is number => t !== null))].sort((a, b) => a - b);
  const maxVal = Math.max(...data.map(d => d.kcal), ...levels, ...data.map(d => d.min ?? 0));
  const maxDisplayValue = Math.ceil(maxVal * 1.15);

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">This week</h2>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -16 }}>
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
                <Cell key={entry.date} fill={intakeBarColor(entry.kcal, entry.min, entry.target)} />
              ))}
            </Bar>
            {levels.map((level, i) => (
              <ReferenceLine
                key={level}
                y={level}
                stroke="var(--amber)"
                strokeDasharray="6 3"
                strokeWidth={1.5}
                label={{
                  value: levels.length > 1 && i === levels.length - 1 ? `Gym day ${level}` : `Target ${level}`,
                  position: 'right',
                  fill: 'var(--muted)',
                  fontSize: 11,
                }}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
