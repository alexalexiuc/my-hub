'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { SectionCard } from '@/components/SectionCard';

interface WeightPoint {
  date: string;
  label: string;
  value: number;
}

interface Props {
  data: WeightPoint[];
}

export function WeightChart({ data }: Props) {
  if (data.length < 2) return null;

  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.2, 0.5);

  return (
    <SectionCard title="Weight trend">
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#52525b', fontSize: 11 }}
              domain={[Math.floor(min - padding), Math.ceil(max + padding)]}
              width={50}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: 8,
                fontSize: 13,
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
              stroke="#818cf8"
              strokeWidth={2}
              dot={{ fill: '#818cf8', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#a5b4fc' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}
