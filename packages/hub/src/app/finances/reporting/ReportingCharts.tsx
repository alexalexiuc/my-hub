'use client';

import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { fmt, tooltipBoxStyle, CategoryIcon } from '../ui';
import type {
  ReportingCategoryItem,
  ReportingPayeeItem,
  ReportingCashflowMonth,
} from '@/app/api/finances/reporting/route';
import type { SupportedCurrency } from '@my-hub/shared/constants';

const FALLBACK_COLOR = 'var(--accent)';

// ─── Shared bar row ───────────────────────────────────────────────────────────

type BarRowProps = {
  leading: React.ReactNode;
  name: string;
  amount: number;
  prevAmount: number;
  currency: SupportedCurrency;
  barColor: string;
  trailingStat: React.ReactNode;
  max: number;
};

function BarRow({ leading, name, amount, prevAmount, currency, barColor, trailingStat, max }: BarRowProps) {
  const barWidth = Math.max(4, (amount / max) * 100);
  const prevBarWidth = Math.max(0, (prevAmount / max) * 100);
  const delta = prevAmount > 0 ? ((amount - prevAmount) / prevAmount) * 100 : null;

  return (
    <div className="flex items-center gap-2.5">
      {leading}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between gap-1">
          <span className="truncate text-[11px] text-[var(--text)]">{name}</span>
          <div className="flex shrink-0 items-center gap-1.5">
            {delta !== null && (
              <span
                className="text-[10px] font-medium"
                style={{ color: delta > 5 ? 'var(--red)' : delta < -5 ? 'var(--green)' : 'var(--muted)' }}
              >
                {delta > 0 ? '+' : ''}
                {delta.toFixed(0)}%
              </span>
            )}
            <span className="text-[11px] font-semibold text-[var(--text)]">{fmt(amount, currency)}</span>
            <span className="text-[9px] text-[var(--subtle)]">{trailingStat}</span>
          </div>
        </div>
        <div className="relative h-1.5 overflow-hidden rounded-full bg-[var(--card3)]">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all"
            style={{ width: `${barWidth}%`, backgroundColor: barColor }}
          />
        </div>
        {prevAmount > 0 && (
          <div className="relative mt-0.5 h-[3px] overflow-hidden rounded-full bg-[var(--card3)]">
            <div
              className="absolute inset-y-0 left-0 rounded-full opacity-40 transition-all"
              style={{ width: `${prevBarWidth}%`, backgroundColor: barColor }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Category bar chart ───────────────────────────────────────────────────────

type CategoryBarChartProps = {
  categories: ReportingCategoryItem[];
  currency: SupportedCurrency;
};

export function CategoryBarChart({ categories, currency }: CategoryBarChartProps) {
  if (categories.length === 0) return null;
  const max = categories.reduce((m, c) => Math.max(m, c.amount, c.prevAmount), 1);

  return (
    <div className="flex flex-col gap-2">
      {categories.map(cat => (
        <BarRow
          key={cat.id}
          leading={<CategoryIcon color={cat.color} icon={cat.icon} size="sm" />}
          name={cat.name}
          amount={cat.amount}
          prevAmount={cat.prevAmount}
          currency={currency}
          barColor={cat.color ?? FALLBACK_COLOR}
          trailingStat={`${cat.pct}%`}
          max={max}
        />
      ))}
    </div>
  );
}

// ─── Payee bar chart ──────────────────────────────────────────────────────────

type PayeeBarChartProps = {
  payees: ReportingPayeeItem[];
  currency: SupportedCurrency;
};

export function PayeeBarChart({ payees, currency }: PayeeBarChartProps) {
  if (payees.length === 0) return null;
  const max = payees.reduce((m, p) => Math.max(m, p.totalSpent, p.prevSpent), 1);

  return (
    <div className="flex flex-col gap-2">
      {payees.map(p => (
        <BarRow
          key={p.payeeId}
          leading={
            <div
              className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] text-[10px] font-bold uppercase"
              style={{ background: 'var(--card3)', color: 'var(--muted)' }}
            >
              {p.name[0]}
            </div>
          }
          name={p.name}
          amount={p.totalSpent}
          prevAmount={p.prevSpent}
          currency={currency}
          barColor="var(--accent)"
          trailingStat={`×${p.transactionCount}`}
          max={max}
        />
      ))}
    </div>
  );
}

// ─── Cashflow bar chart ───────────────────────────────────────────────────────

type CashflowBarChartProps = {
  data: ReportingCashflowMonth[];
  currency: SupportedCurrency;
};

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

// ─── Summary delta badge ──────────────────────────────────────────────────────

type SummaryDeltaProps = {
  current: number;
  prev: number;
  lowerIsBetter?: boolean;
};

export function SummaryDelta({ current, prev, lowerIsBetter = false }: SummaryDeltaProps) {
  if (prev === 0) return null;
  const delta = ((current - prev) / prev) * 100;
  const sign = lowerIsBetter ? -1 : 1;
  const color = delta * sign > 5 ? 'var(--green)' : delta * sign < -5 ? 'var(--red)' : 'var(--muted)';
  return (
    <span className="text-[10px] font-medium" style={{ color }}>
      {delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(0)}%
    </span>
  );
}
