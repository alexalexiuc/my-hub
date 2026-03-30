'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { SectionCard } from '@/components/SectionCard';

interface Props {
  protein: number;
  carbs: number;
  fat: number;
}

const COLORS = {
  carbs: '#fbbf24', // amber-400
  protein: '#38bdf8', // sky-400
  fat: '#fb7185', // rose-400
};

export function MacroChart({ protein, carbs, fat }: Props) {
  const proteinCal = protein * 4;
  const carbsCal = carbs * 4;
  const fatCal = fat * 9;
  const total = proteinCal + carbsCal + fatCal;

  const data = [
    { name: 'Carbs', value: carbsCal, grams: carbs, color: COLORS.carbs },
    { name: 'Protein', value: proteinCal, grams: protein, color: COLORS.protein },
    { name: 'Fat', value: fatCal, grams: fat, color: COLORS.fat },
  ];

  const pct = (val: number) => (total > 0 ? Math.round((val / total) * 100) : 0);

  return (
    <SectionCard title="Macro split">
      {total === 0 ? (
        <div className="h-48 flex items-center justify-center">
          <p className="text-sm text-zinc-500">No macro data logged today</p>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          {/* Donut */}
          <div className="relative w-[130px] h-[130px] flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={56}
                  dataKey="value"
                  strokeWidth={0}
                  animationDuration={800}
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                  formatter={(value, name) => {
                    const item = data.find((d) => d.name === name);
                    return [`${item?.grams ?? 0}g (${value} kcal)`, name];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold">{total}</span>
              <span className="text-[10px] text-zinc-500">kcal</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-3">
            {data.map((entry) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-zinc-400">{entry.name}</span>
                    <span className="text-xs text-zinc-500">{pct(entry.value)}%</span>
                  </div>
                  <div className="mt-0.5 h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct(entry.value)}%`, backgroundColor: entry.color }}
                    />
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{entry.grams}g</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
