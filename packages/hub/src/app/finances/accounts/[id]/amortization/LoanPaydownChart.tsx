import type { ScheduleRow } from '@/app/api/finances/accounts/[id]/amortization/route';
import { fmt } from '../../../ui';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type LoanPaydownChartProps = {
  rows: ScheduleRow[];
  principal: number;
  currency: string;
  height?: number;
};

export function LoanPaydownChart({ rows, principal, currency, height = 110 }: LoanPaydownChartProps) {
  if (!rows.length || principal <= 0) return null;

  const totalPayments = rows.length;
  const currentRowIdx = rows.findIndex(r => r.current);
  const currentPayment = currentRowIdx >= 0 ? currentRowIdx + 1 : rows.filter(r => r.paid).length;

  const chartData = [
    { payment: 0, balance: principal },
    ...rows.map(row => ({ payment: row.n, balance: row.balance })),
  ];

  const paidPct = Math.max(
    0,
    Math.min(100, Math.round(((principal - (rows[currentRowIdx]?.balance ?? 0)) / principal) * 100)),
  );

  const chartHeight = Math.max(150, height + 48);

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--fin-subtle)]">Paydown</div>
        <div className="text-[10px] font-semibold text-[var(--fin-green)]">{paidPct}% paid</div>
      </div>

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
            dataKey="payment"
            type="number"
            tickCount={5}
            domain={[0, totalPayments]}
            tick={{ fill: 'var(--fin-subtle)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            label={{
              value: 'Payment #',
              position: 'insideBottomRight',
              offset: -4,
              fill: 'var(--fin-subtle)',
              fontSize: 10,
            }}
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
            formatter={value => [fmt(Number(value), currency), 'Balance']}
            labelFormatter={label => `Payment ${label}`}
            contentStyle={{
              border: '1px solid var(--fin-border)',
              borderRadius: 10,
              background: 'var(--fin-card)',
              fontSize: 12,
              color: 'var(--fin-text)',
            }}
          />

          {currentPayment > 0 && currentPayment <= totalPayments && (
            <ReferenceLine
              x={currentPayment}
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
    </div>
  );
}
