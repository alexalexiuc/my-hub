'use client';

import { daysBetweenDateStr, formatMoney } from '@my-hub/shared/utils';
import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiFetch, cn, readLocalCache, writeLocalCache } from '@/lib/utils';
import { FinModalShell } from '../FinModalShell';
import { tooltipBoxStyle } from '../ui';
import type { PortfolioHistoryPoint } from '@my-hub/shared/services';
import type { PortfolioHistoryResponse } from '@/app/api/finances/portfolio/history/route';
import { HistoryHeadline } from './HistoryHeadline';
import {
  HISTORY_RANGES,
  HISTORY_SERIES,
  fitAxis,
  formatAxisTick,
  monthStartDates,
  formatHistoryTick,
  isHistoryRange,
  isHistorySeries,
  rangeCoversInception,
  sliceHistory,
  summarizeHistory,
  zeroCrossOffset,
  type HistoryRange,
  type HistorySeries,
} from './portfolio.utils';

type HistoryModalProps = {
  currency: string;
  targetAmount: number | null;
  onClose: () => void;
};

type ChartPoint = PortfolioHistoryPoint & { profit: number };

const RANGE_CACHE_KEY = 'portfolio-history-range';
const SERIES_CACHE_KEY = 'portfolio-history-series';
const AXIS_TICK = { fill: 'var(--subtle)', fontSize: 10 };
const CHART_HEIGHT = 'h-[min(52vh,420px)] md:h-[340px]';

export function HistoryModal({ currency, targetAmount, onClose }: HistoryModalProps) {
  const [points, setPoints] = useState<ChartPoint[] | null>(null);
  const [range, setRange] = useState<HistoryRange>(() => readLocalCache(RANGE_CACHE_KEY, isHistoryRange) ?? '3M');
  const [series, setSeries] = useState<HistorySeries>(
    () => readLocalCache(SERIES_CACHE_KEY, isHistorySeries) ?? 'value',
  );

  useEffect(() => {
    apiFetch<PortfolioHistoryResponse>('/api/finances/portfolio/history', { silentToast: true })
      .then(res => setPoints(res.points.map(p => ({ ...p, profit: Math.round((p.value - p.invested) * 100) / 100 }))))
      .catch(() => setPoints([]));
  }, []);

  const { visible, summary } = useMemo(() => {
    if (!points?.length) return { visible: [], summary: null };
    const sliced = sliceHistory(points, range);
    return { visible: sliced, summary: summarizeHistory(sliced, rangeCoversInception(points, range)) };
  }, [points, range]);
  const spanDays = visible.length > 1 ? daysBetweenDateStr(visible[0]!.date, visible.at(-1)!.date) : 0;
  const zeroOffset = useMemo(() => zeroCrossOffset(visible.map(p => p.profit)), [visible]);
  const yAxis = useMemo(() => {
    const values = visible.flatMap(p =>
      series === 'value' ? [p.value, p.invested] : series === 'profit' ? [p.profit] : [p.invested],
    );
    return fitAxis(Math.min(...values), Math.max(...values));
  }, [visible, series]);
  const yStep = (yAxis.ticks[1] ?? 0) - (yAxis.ticks[0] ?? 0);
  const xTicks = useMemo(
    () => (spanDays > 100 ? monthStartDates(visible.map(p => p.date)) : undefined),
    [visible, spanDays],
  );

  const trendColor = (summary?.gain ?? 0) >= 0 ? 'var(--green)' : 'var(--red)';
  const rangeTitle = HISTORY_RANGES.find(r => r.key === range)!.title.toLowerCase();

  return (
    <FinModalShell onClose={onClose} title="Portfolio Value" className="md:max-w-[760px]">
      {summary && (
        <HistoryHeadline
          summary={summary}
          series={series}
          currency={currency}
          rangeLabel={rangeTitle}
          targetAmount={targetAmount}
        />
      )}

      <SegmentedTabs
        label="Date range"
        options={HISTORY_RANGES}
        value={range}
        onChange={r => {
          setRange(r);
          writeLocalCache(RANGE_CACHE_KEY, r);
        }}
      />

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
        <div className={cn('-mx-1', CHART_HEIGHT)} data-testid="portfolio-history-chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={visible} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="portfolioValueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={trendColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={trendColor} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="portfolioInvestedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
                </linearGradient>
                {/* Hard stop at zero: green above, red below. */}
                <linearGradient id="portfolioProfitStroke" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={zeroOffset} stopColor="var(--green)" />
                  <stop offset={zeroOffset} stopColor="var(--red)" />
                </linearGradient>
                <linearGradient id="portfolioProfitFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={0} stopColor="var(--green)" stopOpacity={0.3} />
                  <stop offset={zeroOffset} stopColor="var(--green)" stopOpacity={0.05} />
                  <stop offset={zeroOffset} stopColor="var(--red)" stopOpacity={0.05} />
                  <stop offset={1} stopColor="var(--red)" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={AXIS_TICK}
                tickFormatter={d => formatHistoryTick(String(d), spanDays)}
                ticks={xTicks}
                interval={xTicks ? 0 : 'preserveStartEnd'}
                minTickGap={40}
              />
              <YAxis
                orientation="right"
                width={48}
                axisLine={false}
                tickLine={false}
                tick={AXIS_TICK}
                tickFormatter={v => formatAxisTick(Number(v), yStep)}
                domain={yAxis.domain}
                ticks={yAxis.ticks}
                allowDataOverflow
              />
              <Tooltip
                cursor={{ stroke: 'var(--subtle)', strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  const p = active ? (payload?.[0]?.payload as ChartPoint | undefined) : undefined;
                  if (!p) return null;
                  return (
                    <div style={tooltipBoxStyle}>
                      <div style={{ color: 'var(--muted)', fontSize: 10, marginBottom: 4 }}>{p.date}</div>
                      <div style={{ fontWeight: series === 'value' ? 600 : 400 }}>
                        Value: {formatMoney(p.value, currency)}
                      </div>
                      <div style={{ color: 'var(--muted)', fontWeight: series === 'invested' ? 600 : 400 }}>
                        Invested: {formatMoney(p.invested, currency)}
                      </div>
                      <div
                        style={{
                          color: p.profit >= 0 ? 'var(--green)' : 'var(--red)',
                          fontWeight: series === 'profit' ? 600 : 400,
                        }}
                      >
                        Profit: {formatMoney(p.profit, currency, { signed: true })}
                      </div>
                    </div>
                  );
                }}
              />
              {series === 'value' && (
                <>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={trendColor}
                    strokeWidth={2}
                    fill="url(#portfolioValueFill)"
                    isAnimationActive={false}
                    activeDot={{ r: 4, fill: trendColor, strokeWidth: 0 }}
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
                </>
              )}
              {series === 'profit' && (
                <>
                  <ReferenceLine y={0} stroke="var(--subtle)" strokeDasharray="4 3" />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    // Fill to the zero line when it is on screen, else to the axis edge nearest zero.
                    baseValue={zeroOffset === 1 ? 'dataMin' : zeroOffset === 0 ? 'dataMax' : 0}
                    stroke="url(#portfolioProfitStroke)"
                    strokeWidth={2}
                    fill="url(#portfolioProfitFill)"
                    isAnimationActive={false}
                    activeDot={{ r: 4, fill: 'var(--text)', strokeWidth: 0 }}
                  />
                </>
              )}
              {series === 'invested' && (
                <Area
                  type="stepAfter"
                  dataKey="invested"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  fill="url(#portfolioInvestedFill)"
                  isAnimationActive={false}
                  activeDot={{ r: 4, fill: 'var(--accent)', strokeWidth: 0 }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-3 flex justify-center">
        <SegmentedTabs
          label="Chart shows"
          options={HISTORY_SERIES}
          value={series}
          onChange={s => {
            setSeries(s);
            writeLocalCache(SERIES_CACHE_KEY, s);
          }}
          className="mb-0 w-full max-w-[320px]"
        />
      </div>
      <p className="mt-1.5 text-center text-[10px] text-[var(--muted)]">
        {series === 'value' && 'Market value; the dashed line is money put in.'}
        {series === 'profit' && 'Value minus money put in — buys do not move this line.'}
        {series === 'invested' && 'Money put in — each step is a buy.'}
      </p>
    </FinModalShell>
  );
}

type SegmentedTabsProps<K extends string> = {
  label: string;
  options: readonly { key: K; label: string; title?: string }[];
  value: K;
  onChange: (key: K) => void;
  className?: string;
};

function SegmentedTabs<K extends string>({ label, options, value, onChange, className }: SegmentedTabsProps<K>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('mb-3 flex rounded-[10px] border border-[var(--border)] bg-[var(--card2)] p-0.5', className)}
    >
      {options.map(({ key, label: text, title }) => {
        const active = key === value;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            title={title}
            aria-selected={active}
            onClick={() => onChange(key)}
            className={cn(
              'flex-auto whitespace-nowrap rounded-[8px] px-1 py-1.5 text-[11px] transition-colors sm:text-[12px]',
              active
                ? 'bg-[var(--accent-d)] font-semibold text-[var(--accent)]'
                : 'text-[var(--muted)] hover:text-[var(--text)]',
            )}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}
