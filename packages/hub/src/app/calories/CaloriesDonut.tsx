'use client';

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { calcCalorieDonutState } from './calories.utils';

interface CaloriesDonutProps {
  eaten: number;
  cap: number | null;
  min?: number | null;
  /** Inner radius of the donut ring. Defaults to 44. */
  innerRadius?: number;
  /** Text size class for the center number. Defaults to 'text-xl'. */
  textSize?: string;
}

/**
 * Shared calorie donut chart with center text.
 * Shows remaining/over state when cap is set, raw total otherwise.
 */
export function CaloriesDonut({ eaten, cap, min = null, innerRadius = 44, textSize = 'text-xl' }: CaloriesDonutProps) {
  const { isOver, isUnder, remaining, arcColor, chartData, overflowData } = calcCalorieDonutState(eaten, cap, min);

  return (
    <div className="relative w-[140px] h-[140px] flex-shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          {isOver ? (
            <>
              <Pie
                data={[{ value: 1, key: 'bg' }]}
                cx="50%"
                cy="50%"
                innerRadius={innerRadius}
                outerRadius={62}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                strokeWidth={0}
                isAnimationActive={false}
              >
                <Cell fill="#ef4444" />
              </Pie>
              <Pie
                data={overflowData}
                cx="50%"
                cy="50%"
                innerRadius={innerRadius}
                outerRadius={62}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                strokeWidth={0}
                animationDuration={800}
              >
                <Cell key="overflow" fill="#fecaca" />
                <Cell key="overflow-empty" fill="transparent" />
              </Pie>
            </>
          ) : (
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={62}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              strokeWidth={0}
              animationDuration={800}
            >
              {chartData.map((entry, i) => (
                <Cell key={entry.key} fill={i === 0 ? arcColor : '#27272a'} />
              ))}
            </Pie>
          )}
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${textSize} font-bold ${isOver ? 'text-red-400' : isUnder ? 'text-yellow-400' : ''}`}>
          {cap !== null ? (isOver ? `+${eaten - cap}` : remaining) : eaten}
        </span>
        <span className="text-[10px] text-zinc-500">{cap !== null ? (isOver ? 'Over' : 'Remaining') : 'kcal'}</span>
      </div>
    </div>
  );
}
