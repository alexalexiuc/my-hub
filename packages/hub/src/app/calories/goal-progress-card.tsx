'use client';

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import type { TooltipContentProps, TooltipPayloadEntry } from 'recharts';
import SectionCard from '@/components/section-card';

interface DayData {
  date: string;
  label: string;
  kcal: number;
}

interface Props {
  data: DayData[];
  target: number | null;
}

function CustomTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;
  const date = (payload[0] as { payload?: { date?: string } })?.payload?.date ?? label;

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
      {payload.map((entry: TooltipPayloadEntry) => (
        <p
          key={entry.name as string}
          style={{ color: (entry.color as string | undefined) ?? '#e4e4e7', marginBottom: 2 }}
        >
          {entry.name === 'actual' ? 'Actual' : 'Projected'}:{' '}
          <strong>{entry.value != null ? `${entry.value as number} kcal` : '—'}</strong>
        </p>
      ))}
    </div>
  );
}

export default function GoalProgressCard({ data, target }: Props) {
  if (!target || data.length === 0) return null;

  const today = new Date().toISOString().split('T')[0] ?? '';

  let cumulativeActual = 0;
  let cumulativeProjected = 0;
  const chartData = data.map(({ date, label, kcal }) => {
    const isPast = date <= today;
    if (isPast) cumulativeActual += kcal;
    cumulativeProjected += target;
    return {
      date,
      label,
      actual: isPast ? cumulativeActual : null,
      projected: cumulativeProjected,
    };
  });

  const lastPastIndex = data.reduce((idx, d, i) => (d.date <= today ? i : idx), -1);
  const totalActual = lastPastIndex >= 0 ? (chartData[lastPastIndex]?.actual ?? 0) : 0;
  const totalProjected = (lastPastIndex + 1) * target;
  const delta = totalActual - totalProjected;

  const maxVal = Math.max(...chartData.map((d) => Math.max(d.actual ?? 0, d.projected)));
  const maxDisplayValue = Math.ceil(maxVal * 1.1);
  const numDigits = String(maxDisplayValue).length;
  const yAxisWidth = numDigits >= 5 ? 56 : 46;
  const leftMargin = numDigits >= 5 ? -6 : -16;

  const summaryColor = delta > 0 ? 'text-red-400' : delta < 0 ? 'text-green-400' : 'text-zinc-400';
  const summaryText =
    delta > 0 ? `+${delta} kcal over target` : delta < 0 ? `${Math.abs(delta)} kcal under target` : 'On track';

  return (
    <SectionCard title="Weekly goal progress">
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-sm text-zinc-400">
          <span className="font-semibold text-zinc-200">{totalActual.toLocaleString()}</span> /{' '}
          {totalProjected.toLocaleString()} kcal so far
        </span>
        {lastPastIndex >= 0 && <span className={`text-xs font-medium ${summaryColor}`}>{summaryText}</span>}
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: leftMargin }}>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#52525b', fontSize: 11 }}
              domain={[0, maxDisplayValue]}
              width={yAxisWidth}
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
            <Legend
              wrapperStyle={{ fontSize: 11, color: '#71717a', paddingTop: 4 }}
              formatter={(value) => (value === 'actual' ? 'Actual' : 'Projected')}
            />
            <Bar dataKey="actual" name="actual" radius={[4, 4, 0, 0]} maxBarSize={40} fill="#6366f1" />
            <Line
              dataKey="projected"
              name="projected"
              type="monotone"
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeDasharray="6 3"
              dot={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}
