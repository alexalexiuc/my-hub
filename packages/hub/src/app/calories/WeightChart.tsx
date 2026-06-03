'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '@/components';

interface WeightPoint {
  date: string;
  label: string;
  value: number;
}

type WeightChartProps = {
  data: WeightPoint[];
};

export function WeightChart({ data }: WeightChartProps) {
  if (data.length < 2) return null;

  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.2, 0.5);

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">Weight trend</h2>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--subtle)', fontSize: 12 }} />
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
              labelFormatter={label => {
                const item = data.find(d => d.label === label);
                return item?.date ?? label;
              }}
              formatter={value => [`${value} kg`, 'Weight']}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={{ fill: 'var(--accent)', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: 'var(--accent)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
