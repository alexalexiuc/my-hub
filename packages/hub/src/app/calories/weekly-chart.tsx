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
import SectionCard from '@/components/section-card';

interface DayData {
  date: string;
  label: string;
  kcal: number;
}

interface Props {
  data: DayData[];
  target: number | null;
  min?: number | null;
  max?: number | null;
}

function getBarColor(
  kcal: number,
  min: number | null | undefined,
  max: number | null | undefined,
  target: number | null,
): string {
  if (!target && !min && !max) return '#71717a'; // no targets — neutral
  const ceiling = max ?? target;
  if (ceiling !== null && kcal > ceiling) return '#ef4444'; // over ceiling — red
  if (min != null && kcal > 0 && kcal < min) return '#f97316'; // under floor — orange
  if (kcal === 0) return '#3f3f46'; // no data — zinc
  return '#4ade80'; // on target — green
}

function CustomTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;
  const kcal = (payload[0]?.value as number | undefined) ?? 0;
  const target = (payload[0] as { payload?: { _target?: number | null } })?.payload?._target ?? null;
  const min = (payload[0] as { payload?: { _min?: number | null } })?.payload?._min ?? null;
  const max = (payload[0] as { payload?: { _max?: number | null } })?.payload?._max ?? null;
  const date = (payload[0] as { payload?: { date?: string } })?.payload?.date ?? label;

  const ceiling = max ?? target;
  let deltaLine: string | null = null;
  if (ceiling !== null) {
    const delta = kcal - ceiling;
    if (delta > 0) deltaLine = `+${delta} kcal above target`;
    else if (delta < 0) deltaLine = `${Math.abs(delta)} kcal below target`;
    else deltaLine = 'On target';
  } else if (min != null && kcal < min) {
    deltaLine = `${min - kcal} kcal below min`;
  }

  return (
    <div
      style={{
        background: '#18181b',
        border: '1px solid #3f3f46',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 13,
      }}
    >
      <p style={{ color: '#a1a1aa', marginBottom: 4 }}>{String(date)}</p>
      <p style={{ color: '#e4e4e7', fontWeight: 600 }}>{kcal} kcal</p>
      {deltaLine && <p style={{ color: '#71717a', marginTop: 2 }}>{deltaLine}</p>}
    </div>
  );
}

export default function WeeklyChart({ data, target, min, max }: Props) {
  if (data.length === 0) return null;

  const maxVal = Math.max(...data.map((d) => d.kcal), target ?? 0, max ?? 0);
  const maxDisplayValue = Math.ceil(maxVal * 1.15);

  // Embed target/min/max in each data point for the custom tooltip
  const chartData = data.map((d) => ({ ...d, _target: target, _min: min ?? null, _max: max ?? null }));

  return (
    <SectionCard title="This week">
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: -16 }}>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#52525b', fontSize: 11 }}
              domain={[0, maxDisplayValue]}
              width={56}
            />
            <RechartsTooltip
              cursor={{ fill: 'rgba(63, 63, 70, 0.3)' }}
              content={(props) => (
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
              {data.map((entry) => (
                <Cell key={entry.date} fill={getBarColor(entry.kcal, min, max, target)} />
              ))}
            </Bar>
            {target && (
              <ReferenceLine
                y={target}
                stroke="#f59e0b"
                strokeDasharray="6 3"
                strokeWidth={1.5}
                label={{
                  value: `Target ${target}`,
                  position: 'right',
                  fill: '#a1a1aa',
                  fontSize: 11,
                }}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}
