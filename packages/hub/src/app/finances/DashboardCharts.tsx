'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, ResponsiveContainer, Tooltip, LineChart, Line, XAxis } from 'recharts';
import { fmt } from './ui';
import type { DashboardCategory, DailySpendingPoint } from '@/app/api/finances/dashboard/route';
import type { SupportedCurrency } from '@my-hub/shared/constants';

const FALLBACK_COLOR = 'var(--fin-subtle)';

const tooltipBoxStyle = {
  backgroundColor: 'var(--fin-card)',
  border: '1px solid var(--fin-border)',
  borderRadius: 8,
  padding: '6px 10px',
  fontSize: 12,
  color: 'var(--fin-text)',
} as const;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

type PieEntry = { name: string; value: number; fill: string };

function PieTooltip({ currency }: { currency: SupportedCurrency }) {
  return (
    <Tooltip
      content={({ active, payload }) => {
        if (!active || !payload?.length) return null;
        const item = payload[0];
        if (!item) return null;
        return (
          <div style={tooltipBoxStyle}>
            <div style={{ color: 'var(--fin-muted)', fontSize: 10, marginBottom: 2 }}>{item.name}</div>
            <div style={{ fontWeight: 600 }}>
              {typeof item.value === 'number' ? fmt(item.value, currency) : String(item.value)}
            </div>
          </div>
        );
      }}
    />
  );
}

type CategoryPieChartProps = {
  categories: DashboardCategory[];
  currency: SupportedCurrency;
};

export function CategoryPieChart({ categories, currency }: CategoryPieChartProps) {
  const isDesktop = useIsDesktop();

  if (categories.length === 0) return null;

  const pieData: PieEntry[] = categories.map(c => ({
    name: c.name,
    value: c.spent,
    fill: c.color ?? FALLBACK_COLOR,
  }));

  if (isDesktop) {
    return (
      <div className="flex h-[240px] gap-3">
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius="38%"
                outerRadius="72%"
                dataKey="value"
                strokeWidth={0}
              />
              <PieTooltip currency={currency} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex w-[148px] flex-col gap-1.5 overflow-y-auto py-0.5">
          {pieData.map((entry, i) => (
            <div key={i} className="flex min-w-0 items-center gap-1.5">
              <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: entry.fill }} />
              <span className="min-w-0 flex-1 truncate text-[10px] text-[var(--fin-muted)]">{entry.name}</span>
              <span className="flex-shrink-0 text-[10px] font-medium text-[var(--fin-text)]">
                {fmt(entry.value, currency)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius="42%" outerRadius="68%" dataKey="value" strokeWidth={0} />
            <PieTooltip currency={currency} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {pieData.map((entry, i) => (
          <div key={i} className="flex min-w-0 items-center gap-1.5">
            <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: entry.fill }} />
            <span className="truncate text-[10px] text-[var(--fin-muted)]">{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type SpendingTrendChartProps = {
  dailySpending: DailySpendingPoint[];
  currency: SupportedCurrency;
  monthLabel?: string;
  prevLabel?: string;
};

export function SpendingTrendChart({ dailySpending, currency, monthLabel, prevLabel }: SpendingTrendChartProps) {
  if (dailySpending.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={dailySpending} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
        <XAxis
          dataKey="day"
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'var(--fin-subtle)', fontSize: 9 }}
          interval="preserveStartEnd"
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div style={tooltipBoxStyle}>
                <div style={{ color: 'var(--fin-muted)', fontSize: 10, marginBottom: 4 }}>Day {label}</div>
                {payload.map((p, i) => (
                  <div key={i} style={{ color: p.color as string, marginBottom: 2 }}>
                    {p.name === 'current' ? (monthLabel ?? 'This month') : (prevLabel ?? 'Prev month')}:{' '}
                    {typeof p.value === 'number' ? fmt(p.value, currency) : String(p.value)}
                  </div>
                ))}
              </div>
            );
          }}
        />
        <Line
          type="monotone"
          dataKey="current"
          stroke="var(--fin-accent)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, fill: 'var(--fin-accent)', strokeWidth: 0 }}
        />
        <Line
          type="monotone"
          dataKey="prev"
          stroke="var(--fin-subtle)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          dot={false}
          activeDot={{ r: 3, fill: 'var(--fin-subtle)', strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
