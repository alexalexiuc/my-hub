'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card } from '@/components';
import { MACRO_COLORS } from './constants';
import { macroCalorieSplit } from './calories.utils';

interface Props {
  protein: number;
  carbs: number;
  fat: number;
  goalProtein: number | null;
  goalCarbs: number | null;
  goalFat: number | null;
  /** Use the bordered-card-at-all-sizes style instead of the default mobile full-bleed — for
   * embedding inside a modal or another card, where full-bleed would break out of the parent's
   * own padding. */
  compact?: boolean;
}

export function MacroChart({ protein, carbs, fat, goalProtein, goalCarbs, goalFat, compact }: Props) {
  const { proteinCal, carbsCal, fatCal, total } = macroCalorieSplit(protein, carbs, fat);

  const data = [
    { name: 'Carbs', value: carbsCal, grams: carbs, goal: goalCarbs, color: MACRO_COLORS.carbs },
    { name: 'Protein', value: proteinCal, grams: protein, goal: goalProtein, color: MACRO_COLORS.protein },
    { name: 'Fat', value: fatCal, grams: fat, goal: goalFat, color: MACRO_COLORS.fat },
  ];

  const pct = (val: number) => (total > 0 ? Math.round((val / total) * 100) : 0);

  return (
    <Card className="p-5" compact={compact}>
      <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">Macro split</h2>
      {total === 0 ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-[var(--subtle)]">No macro data logged today</p>
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
                  {data.map(entry => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 13,
                    color: 'var(--text)',
                  }}
                  formatter={(value, name) => {
                    const item = data.find(d => d.name === name);
                    return [`${item?.grams ?? 0}g (${value} kcal)`, name];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold">{total}</span>
              <span className="text-[10px] text-[var(--subtle)]">kcal</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-3">
            {data.map(entry => {
              const exceeded = entry.goal !== null && entry.grams > entry.goal;
              const barColor = exceeded ? '#b91c1c' : entry.color; // red-700 when over
              return (
                <div key={entry.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: barColor }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-[var(--muted)]">{entry.name}</span>
                      <span
                        className={`text-xs ${exceeded ? 'text-[var(--red)] font-medium' : 'text-[var(--subtle)]'}`}
                      >
                        {entry.goal !== null ? `${entry.grams}g / ${entry.goal}g` : `${pct(entry.value)}%`}
                      </span>
                    </div>
                    <div className="mt-0.5 h-1.5 w-full rounded-full bg-[var(--card2)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width:
                            entry.goal !== null
                              ? `${Math.min(100, Math.round((entry.grams / entry.goal) * 100))}%`
                              : `${pct(entry.value)}%`,
                          backgroundColor: barColor,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
