'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
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

export default function WeeklyChart({ data, target }: Props) {
  if (data.length === 0) return null;

  const maxVal = Math.max(...data.map((d) => d.kcal), target ?? 0);

  return (
    <SectionCard title="Last 7 days">
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#52525b', fontSize: 11 }}
              domain={[0, Math.ceil(maxVal * 1.15)]}
              width={50}
            />
            <Tooltip
              cursor={{ fill: 'rgba(63, 63, 70, 0.3)' }}
              contentStyle={{
                backgroundColor: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: 8,
                fontSize: 13,
              }}
              labelFormatter={(label) => {
                const item = data.find((d) => d.label === label);
                return item?.date ?? label;
              }}
              formatter={(value) => [`${value} kcal`, 'Calories']}
            />
            <Bar dataKey="kcal" radius={[4, 4, 0, 0]} fill="#4ade80" maxBarSize={40} />
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
