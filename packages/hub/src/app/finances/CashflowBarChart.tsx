'use client';

import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { fmt, tooltipBoxStyle } from './ui';

export type CashflowBarPoint = {
  /** X-axis tick, e.g. 'Sep'. */
  label: string;
  income: number;
  expense: number;
};

type CashflowBarChartProps = {
  data: CashflowBarPoint[];
  currency: string;
};

/**
 * Grouped income vs expense bars per period. Fills its container, so the caller sets the height.
 * Shared by the Reporting page and the Cashflow page's Monthly view.
 */
export function CashflowBarChart({ data, currency }: CashflowBarChartProps) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }} barCategoryGap="30%">
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--subtle)', fontSize: 9 }} />
        <Tooltip
          cursor={{ fill: 'var(--card3)' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div style={tooltipBoxStyle}>
                <div style={{ color: 'var(--muted)', fontSize: 10, marginBottom: 4 }}>{label}</div>
                {payload.map((p, i) => (
                  <div key={i} style={{ color: p.color as string, marginBottom: 2 }}>
                    {p.name === 'income' ? 'Income' : 'Expenses'}:{' '}
                    {typeof p.value === 'number' ? fmt(p.value, currency) : String(p.value)}
                  </div>
                ))}
              </div>
            );
          }}
        />
        <Bar dataKey="income" fill="var(--green)" fillOpacity={0.75} radius={[3, 3, 0, 0]} />
        <Bar dataKey="expense" fill="var(--red)" fillOpacity={0.75} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
