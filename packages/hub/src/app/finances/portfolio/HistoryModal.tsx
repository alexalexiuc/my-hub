'use client';

import { formatMoney, formatCompact } from '@my-hub/shared/utils';
import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { apiFetch, cn, readLocalCache, writeLocalCache } from '@/lib/utils';
import { FinModalShell } from '../FinModalShell';
import { tooltipBoxStyle } from '../ui';
import type { PortfolioHistoryPoint } from '@my-hub/shared/services';
import type { PortfolioHistoryResponse } from '@/app/api/finances/portfolio/history/route';
import {
  HISTORY_RANGES,
  formatHistoryTick,
  isHistoryRange,
  rangeCoversInception,
  sliceHistory,
  summarizeHistory,
  type HistoryRange,
  type HistorySummary,
} from './portfolio.utils';

type HistoryModalProps = {
  currency: string;
  targetAmount: number | null;
  onClose: () => void;
};

const RANGE_CACHE_KEY = 'portfolio-history-range';
const AXIS_TICK = { fill: 'var(--subtle)', fontSize: 10 };
const CHART_HEIGHT = 'h-[min(55vh,420px)] md:h-[340px]';

export function HistoryModal({ currency, targetAmount, onClose }: HistoryModalProps) {
  const [points, setPoints] = useState<PortfolioHistoryPoint[] | null>(null);
  const [range, setRangeState] = useState<HistoryRange>(() => readLocalCache(RANGE_CACHE_KEY, isHistoryRange) ?? '3M');

  useEffect(() => {
    apiFetch<PortfolioHistoryResponse>('/api/finances/portfolio/history', { silentToast: true })
      .then(res => setPoints(res.points))
      .catch(() => setPoints([]));
  }, []);

  const setRange = (r: HistoryRange) => {
    setRangeState(r);
    writeLocalCache(RANGE_CACHE_KEY, r);
  };

  const { visible, summary } = useMemo(() => {
    const end = points?.at(-1)?.date;
    if (!points || !end) return { visible: [], summary: null };
    const sliced = sliceHistory(points, range, end);
    return { visible: sliced, summary: summarizeHistory(sliced, rangeCoversInception(points, range, end)) };
  }, [points, range]);
  const up = (summary?.gain ?? 0) >= 0;
  const lineColor = up ? 'var(--green)' : 'var(--red)';

  return (
    <FinModalShell onClose={onClose} title="Portfolio Value" className="md:max-w-[760px]">
      {summary && <HistoryHeadline summary={summary} currency={currency} range={range} targetAmount={targetAmount} />}

      <RangeTabs range={range} onChange={setRange} />

      {points === null && (
        <div className={cn('flex items-center justify-center text-[13px] text-[var(--muted)]', CHART_HEIGHT)}>
          Loading…
        </div>
      )}
      {points !== null && points.length === 0 && (
        <div className={cn('flex items-center justify-center text-[13px] text-[var(--muted)]', CHART_HEIGHT)}>
          No history yet — record a supply first.
        </div>
      )}

      {visible.length > 0 && (
        <>
          <div className={cn('-mx-1', CHART_HEIGHT)} data-testid="portfolio-history-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={visible} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="portfolioValueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={AXIS_TICK}
                  tickFormatter={d => formatHistoryTick(String(d), range)}
                  interval="preserveStartEnd"
                  minTickGap={40}
                />
                <YAxis
                  orientation="right"
                  width={44}
                  axisLine={false}
                  tickLine={false}
                  tick={AXIS_TICK}
                  tickFormatter={v => formatCompact(Number(v))}
                  domain={[
                    (min: number) => Math.floor(min - (min * 0.02 || 1)),
                    (max: number) => Math.ceil(max + (max * 0.02 || 1)),
                  ]}
                  tickCount={5}
                />
                <Tooltip
                  cursor={{ stroke: 'var(--subtle)', strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    const p = active ? (payload?.[0]?.payload as PortfolioHistoryPoint | undefined) : undefined;
                    if (!p) return null;
                    const gain = p.value - p.invested;
                    return (
                      <div style={tooltipBoxStyle}>
                        <div style={{ color: 'var(--muted)', fontSize: 10, marginBottom: 4 }}>{p.date}</div>
                        <div style={{ fontWeight: 600 }}>Value: {formatMoney(p.value, currency)}</div>
                        <div style={{ color: 'var(--muted)' }}>Invested: {formatMoney(p.invested, currency)}</div>
                        <div style={{ color: gain >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          Gain: {formatMoney(gain, currency, { signed: true })}
                        </div>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={lineColor}
                  strokeWidth={2}
                  fill="url(#portfolioValueFill)"
                  isAnimationActive={false}
                  activeDot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
                />
                <Line
                  type="stepAfter"
                  dataKey="invested"
                  stroke="var(--subtle)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  isAnimationActive={false}
                  activeDot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex items-center justify-center gap-4 text-[10px] text-[var(--muted)]">
            <span className="flex items-center gap-1">
              <span className="inline-block h-[2px] w-4" style={{ backgroundColor: lineColor }} />
              Value
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-[2px] w-4 border-t border-dashed border-[var(--subtle)]" />
              Invested
            </span>
          </div>
        </>
      )}
    </FinModalShell>
  );
}

function HistoryHeadline({
  summary,
  currency,
  range,
  targetAmount,
}: {
  summary: HistorySummary;
  currency: string;
  range: HistoryRange;
  targetAmount: number | null;
}) {
  const up = summary.gain >= 0;
  const rangeLabel = range === 'ALL' ? 'all time' : range === 'YTD' ? 'this year' : `last ${range}`;
  return (
    <div className="mb-3">
      <div className="text-[26px] font-bold leading-tight text-[var(--text)]">
        {formatMoney(summary.endValue, currency)}
      </div>
      <div className="mt-0.5 text-[12px]" style={{ color: up ? 'var(--green)' : 'var(--red)' }}>
        {formatMoney(summary.gain, currency, { signed: true })}
        {summary.gainPct !== null && ` (${summary.gainPct >= 0 ? '+' : ''}${summary.gainPct.toFixed(2)}%)`}
        <span className="text-[var(--muted)]"> market gain, {rangeLabel}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[var(--muted)]">
        {summary.deposits > 0 && <span>+{formatMoney(summary.deposits, currency)} added</span>}
        <span>
          Total gain{' '}
          <span style={{ color: summary.totalGain >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {formatMoney(summary.totalGain, currency, { signed: true })}
          </span>
        </span>
        {targetAmount != null && targetAmount > 0 && (
          <span>
            {Math.round((summary.endValue / targetAmount) * 100)}% of {formatMoney(targetAmount, currency)} target
          </span>
        )}
      </div>
    </div>
  );
}

function RangeTabs({ range, onChange }: { range: HistoryRange; onChange: (r: HistoryRange) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Date range"
      className="mb-3 flex rounded-[10px] border border-[var(--border)] bg-[var(--card2)] p-0.5"
    >
      {HISTORY_RANGES.map(({ key, label }) => {
        const active = key === range;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={cn(
              'flex-1 rounded-[8px] py-1.5 text-[12px] transition-colors',
              active
                ? 'bg-[var(--accent-d)] font-semibold text-[var(--accent)]'
                : 'text-[var(--muted)] hover:text-[var(--text)]',
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
