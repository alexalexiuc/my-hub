'use client';

import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card } from '@/components';
import { buildWeightTrend } from '@my-hub/shared/utils';
import { averageWeeklyWeights, dateToTs, formatAxisDate, timeAxisTicks, type WeightPoint } from './calories.utils';
import { WEIGHT_CHART_WEEKLY_AVERAGE_THRESHOLD, WEIGHT_RANGE_OPTIONS, type WeightRangeKey } from './constants';
import { RangeChips } from './ui';

type WeightChartProps = {
  /** Weigh-ins for the selected range, any order. */
  data: WeightPoint[];
  /** The range's own bounds as YYYY-MM-DD. The x-domain follows these, not the data's extent. */
  from: string;
  to: string;
  range: WeightRangeKey;
  onRangeChange: (range: WeightRangeKey) => void;
};

const SERIES_LABELS: Record<string, string> = { value: 'Weigh-in', trend: 'Trend' };

export function WeightChart({ data, from, to, range, onRangeChange }: WeightChartProps) {
  const { points, averaged } = useMemo(() => {
    // Long ranges are averaged by week first: a year of daily readings is an unreadable smear on
    // a phone, and the weekly mean keeps the shape of the trend that matters at that zoom.
    const averaged = data.length > WEIGHT_CHART_WEEKLY_AVERAGE_THRESHOLD;
    const samples = averaged ? averageWeeklyWeights(data) : data;
    return {
      averaged,
      points: buildWeightTrend(samples).map(p => ({ ...p, ts: dateToTs(p.date), label: p.date.slice(5) })),
    };
  }, [data]);

  const domainTs: [number, number] = [dateToTs(from), dateToTs(to)];
  // How much of the requested range holds nothing. Without saying so, a range whose earlier half
  // is empty just looks like the control did nothing.
  const emptyLeadingDays = points[0] ? Math.round((points[0].ts - domainTs[0]) / 86_400_000) : 0;

  const header = (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">Weight trend</h2>
      <RangeChips
        options={WEIGHT_RANGE_OPTIONS}
        value={range}
        onChange={onRangeChange}
        ariaLabel="Weight trend range"
      />
    </div>
  );

  if (points.length < 2) {
    return (
      <Card className="p-5">
        {header}
        <p className="text-xs text-[var(--subtle)]">Not enough weigh-ins in this range to draw a trend.</p>
      </Card>
    );
  }

  const values = points.flatMap(p => [p.value, p.trend]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.15, 0.5);

  return (
    <Card className="p-5">
      {header}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
            {/* Time-scaled, domain pinned to the selected range — see GoalProgressCard for why. */}
            <XAxis
              dataKey="ts"
              type="number"
              domain={domainTs}
              ticks={timeAxisTicks(domainTs[0], domainTs[1])}
              tickFormatter={formatAxisDate}
              allowDataOverflow
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--subtle)', fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--subtle)', fontSize: 11 }}
              domain={[Math.floor(min - padding), Math.ceil(max + padding)]}
              width={50}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 13,
                color: 'var(--text)',
              }}
              labelFormatter={label => points.find(p => p.ts === label)?.date ?? formatAxisDate(label as number)}
              formatter={(value, name) => [
                `${(value as number).toFixed(1)} kg`,
                SERIES_LABELS[name as string] ?? (name as string),
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: 'var(--muted)', paddingTop: 4 }}
              formatter={value => SERIES_LABELS[value as string] ?? value}
            />
            <Line
              type="monotone"
              dataKey="value"
              name="value"
              stroke="var(--subtle)"
              strokeWidth={1}
              strokeOpacity={0.6}
              dot={points.length <= 40 ? { fill: 'var(--subtle)', r: 2, strokeWidth: 0 } : false}
              activeDot={{ r: 4, fill: 'var(--subtle)' }}
            />
            <Line
              type="monotone"
              dataKey="trend"
              name="trend"
              stroke="var(--accent)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: 'var(--accent)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[11px] text-[var(--subtle)]">
        {averaged && 'Averaged by week at this range.'}
        {emptyLeadingDays >= 7 && (
          <span className="text-[var(--amber)]">
            {averaged ? ' ' : ''}
            No weigh-ins in the first {emptyLeadingDays} days of this range.
          </span>
        )}
      </p>
    </Card>
  );
}
