'use client';

import type { ScheduleRow } from '@/app/api/finances/accounts/[id]/amortization/route';
import { fmt } from '../../../ui';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type LoanPaydownChartProps = {
  rows: ScheduleRow[];
  principal: number;
  currency: string;
  nextPaymentDate?: string;
  height?: number;
};

export function LoanPaydownChart({ rows, principal, currency, nextPaymentDate, height = 120 }: LoanPaydownChartProps) {
  if (!rows.length || principal <= 0) return null;

  const chartData = [
    { date: rows[0]!.date.slice(0, 7), balance: principal },
    ...rows.map(row => ({ date: row.date.slice(0, 7), balance: row.balance })),
  ];

  // Show ~5 evenly spaced ticks
  const tickInterval = Math.max(1, Math.floor(rows.length / 5));
  const ticks = chartData
    .filter((_, i) => i === 0 || i === chartData.length - 1 || (i - 1) % tickInterval === 0)
    .map(d => d.date);

  const fmtTick = (val: string) => {
    const [y, m] = val.split('-');
    const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][
      Number(m) - 1
    ];
    return `${monthShort} ${y?.slice(2)}`;
  };

  const chartHeight = Math.max(150, height + 48);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 6 }}>
        <defs>
          <linearGradient id="loanBalanceFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--fin-accent)" stopOpacity={0.24} />
            <stop offset="100%" stopColor="var(--fin-accent)" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <CartesianGrid vertical={false} stroke="var(--fin-border)" strokeDasharray="3 3" opacity={0.5} />

        <XAxis
          dataKey="date"
          type="category"
          ticks={ticks}
          tickFormatter={fmtTick}
          tick={{ fill: 'var(--fin-subtle)', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />

        <YAxis
          type="number"
          domain={[0, principal]}
          width={58}
          tick={{ fill: 'var(--fin-subtle)', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={value => {
            if (typeof value !== 'number') return String(value);
            if (value === 0) return '0';
            if (value >= 1000) return `${Math.round(value / 1000)}k`;
            return String(Math.round(value));
          }}
        />

        <Tooltip
          cursor={{ stroke: 'var(--fin-border)', strokeDasharray: '4 4' }}
          formatter={value => [fmt(Number(value), currency), 'Remaining principal']}
          labelFormatter={(label: unknown) => fmtTick(String(label))}
          contentStyle={{
            border: '1px solid var(--fin-border)',
            borderRadius: 10,
            background: 'var(--fin-card)',
            fontSize: 12,
            color: 'var(--fin-text)',
          }}
        />

        {nextPaymentDate && (
          <ReferenceLine
            x={nextPaymentDate.slice(0, 7)}
            stroke="var(--fin-accent)"
            strokeDasharray="4 4"
            strokeOpacity={0.85}
            label={{ value: 'Now', position: 'insideTopRight', fill: 'var(--fin-accent)', fontSize: 10 }}
          />
        )}

        <Area
          type="monotone"
          dataKey="balance"
          stroke="var(--fin-accent)"
          strokeWidth={2}
          fill="url(#loanBalanceFill)"
          dot={false}
          activeDot={{ r: 3, fill: 'var(--fin-accent)' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
