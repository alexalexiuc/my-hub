'use client';

import { useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, Tooltip, ReferenceLine } from 'recharts';
import { FinModalShell } from '../FinModalShell';
import { fmt, tooltipBoxStyle, FinFieldCard } from '../ui';
import { finGhostInputClass } from '../finances.utils';
import { Input } from '@/components';
import { monthMetaFromIndex, monthsUntilEndOfYear } from './portfolio.utils';
import type { PortfolioOverview } from '@my-hub/shared/services';
import { projectPortfolioGrowth } from '@my-hub/shared/utils';

type ProjectionModalProps = {
  overview: PortfolioOverview;
  onClose: () => void;
};

const SCENARIOS = [
  { key: 'optimistic', label: 'Optimistic', color: 'var(--green)' },
  { key: 'expected', label: 'Expected', color: 'var(--accent)' },
  { key: 'pessimistic', label: 'Pessimistic', color: 'var(--red)' },
] as const;

const CURRENT_YEAR = new Date().getUTCFullYear();
/** Default projection horizon: 30 calendar years out. */
const DEFAULT_TARGET_YEAR = CURRENT_YEAR + 30;

export function ProjectionModal({ overview, onClose }: ProjectionModalProps) {
  const { portfolio, totals } = overview;
  const currency = portfolio.baseCurrency;
  // Compound from today's value (or contributed cash when no prices yet):
  // value_{m+1} = value_m × (1 + r)^(1/12) + monthlyContribution
  const startValue = totals.currentValue ?? totals.contributed;

  const [targetYearInput, setTargetYearInput] = useState(String(DEFAULT_TARGET_YEAR));
  // Clamp to a sane forward-looking window; fall back to the default while the
  // field is being edited (empty / non-numeric).
  const targetYear = Math.min(
    CURRENT_YEAR + 100,
    Math.max(CURRENT_YEAR + 1, Number(targetYearInput) || DEFAULT_TARGET_YEAR),
  );
  const months = monthsUntilEndOfYear(targetYear);

  const { data, yearTicks } = useMemo(() => {
    const series = {
      pessimistic: projectPortfolioGrowth({
        startValue,
        monthlyContribution: portfolio.plannedMonthlyContribution,
        annualReturnPct: portfolio.pessimisticAnnualReturnPct,
        months,
      }),
      expected: projectPortfolioGrowth({
        startValue,
        monthlyContribution: portfolio.plannedMonthlyContribution,
        annualReturnPct: portfolio.expectedAnnualReturnPct,
        months,
      }),
      optimistic: projectPortfolioGrowth({
        startValue,
        monthlyContribution: portfolio.plannedMonthlyContribution,
        annualReturnPct: portfolio.optimisticAnnualReturnPct,
        months,
      }),
    };
    const points = series.expected.map((point, i) => {
      const meta = monthMetaFromIndex(point.monthIndex);
      return {
        label: meta.label,
        year: meta.year,
        month: meta.month,
        pessimistic: Math.round(series.pessimistic[i]!.value),
        expected: Math.round(point.value),
        optimistic: Math.round(series.optimistic[i]!.value),
      };
    });
    // Tick once per calendar year (January points), thinned to keep at most ~8 labels.
    const januaries = points.filter(p => p.month === 0);
    const step = Math.ceil(januaries.length / 8) || 1;
    const yearTicks = januaries.filter((_, i) => i % step === 0).map(p => p.label);
    return { data: points, yearTicks };
    // Depend on the primitive inputs, not the portfolio object reference (which
    // changes on every parent render and would bust this memo needlessly).
  }, [
    startValue,
    months,
    portfolio.plannedMonthlyContribution,
    portfolio.pessimisticAnnualReturnPct,
    portfolio.expectedAnnualReturnPct,
    portfolio.optimisticAnnualReturnPct,
  ]);

  return (
    <FinModalShell onClose={onClose} title={`Projection to ${targetYear}`} className="md:max-w-[1000px]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <FinFieldCard label="Project to year" className="w-32">
          <Input
            type="number"
            variant="ghost"
            className={finGhostInputClass}
            value={targetYearInput}
            min={CURRENT_YEAR + 1}
            max={CURRENT_YEAR + 100}
            onChange={e => setTargetYearInput(e.target.value)}
          />
        </FinFieldCard>
        <span className="flex items-center gap-2 text-[9px] text-[var(--muted)]">
          {SCENARIOS.map(s => (
            <span key={s.key} className="flex items-center gap-1">
              <span className="inline-block h-[2px] w-4" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </span>
      </div>

      <div className="mb-2 text-[9px] text-[var(--muted)]">
        Start {fmt(startValue, currency)} · {fmt(portfolio.plannedMonthlyContribution, currency)}/month ·{' '}
        {portfolio.pessimisticAnnualReturnPct}% / {portfolio.expectedAnnualReturnPct}% /{' '}
        {portfolio.optimisticAnnualReturnPct}% p.a.
      </div>

      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <XAxis
              dataKey="label"
              ticks={yearTicks}
              tickFormatter={label => String(label).slice(-4)}
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--subtle)', fontSize: 9 }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div style={tooltipBoxStyle}>
                    <div style={{ color: 'var(--muted)', fontSize: 10, marginBottom: 4 }}>{label}</div>
                    {payload.map((p, i) => (
                      <div key={i} style={{ color: p.color as string, marginBottom: 2 }}>
                        {SCENARIOS.find(s => s.key === p.name)?.label ?? p.name}:{' '}
                        {typeof p.value === 'number' ? fmt(p.value, currency) : String(p.value)}
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            {SCENARIOS.map(s => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={s.key === 'expected' ? 2 : 1.5}
                dot={false}
                activeDot={{ r: 3, fill: s.color, strokeWidth: 0 }}
              />
            ))}
            {portfolio.targetAmount != null && (
              <ReferenceLine
                y={portfolio.targetAmount}
                stroke="var(--subtle)"
                strokeDasharray="4 3"
                label={{
                  value: `Target: ${fmt(portfolio.targetAmount, currency)}`,
                  position: 'insideTopLeft',
                  fill: 'var(--subtle)',
                  fontSize: 9,
                }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </FinModalShell>
  );
}
