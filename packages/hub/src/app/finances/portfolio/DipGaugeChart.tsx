'use client';

import { useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { drawdownLevel } from '@my-hub/shared/utils';
import type { PortfolioDrawdown } from '@my-hub/shared/services';
import { tooltipBoxStyle } from '../ui';
import { dateStrToMs } from './portfolio.utils';
import {
  drawdownAxis,
  drawdownColor,
  evenTicks,
  formatDayLabel,
  formatDayTick,
  formatDrawdown,
  type DrawdownWindow,
} from './drawdown.utils';

type DipGaugeChartProps = {
  drawdown: PortfolioDrawdown;
  window: DrawdownWindow;
  selectedBuyDate: string | null;
  onSelectBuy: (date: string) => void;
};

type ChartRow = { t: number; date: string; value: number; dd30: number; dd52: number };

const AXIS_TICK = { fill: 'var(--subtle)', fontSize: 9 };
const MIN_DOT_RADIUS = 3.5;
const MAX_DOT_RADIUS = 8;

/** Drawdown-from-peak area chart with threshold lines and one dot per buy, sized by amount and tinted by depth. */
export function DipGaugeChart({ drawdown, window, selectedBuyDate, onSelectBuy }: DipGaugeChartProps) {
  const { series, buys, thresholds } = drawdown;
  const rows = useMemo<ChartRow[]>(
    () => series.map(p => ({ t: dateStrToMs(p.date), date: p.date, value: p[window], dd30: p.dd30, dd52: p.dd52 })),
    [series, window],
  );
  if (rows.length < 2) {
    return (
      <div className="flex h-[220px] items-center justify-center text-[12px] text-[var(--muted)]">
        Not enough history yet
      </div>
    );
  }

  const first = rows[0]!;
  const last = rows[rows.length - 1]!;
  const axis = drawdownAxis(Math.min(...rows.map(r => r.value)));
  const ticks = evenTicks(first.t, last.t, 4);
  const shownBuys = buys.filter(b => b.date >= first.date && b[window] !== null);
  const maxAmount = Math.max(1, ...shownBuys.map(b => b.amount));

  return (
    <div className="-mx-1 h-[220px]" data-testid="dip-gauge-chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="dipGaugeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.05} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[first.t, last.t]}
            ticks={ticks}
            tickFormatter={formatDayTick}
            axisLine={false}
            tickLine={false}
            tick={AXIS_TICK}
            interval="preserveStartEnd"
          />
          <YAxis
            width={40}
            axisLine={false}
            tickLine={false}
            tick={AXIS_TICK}
            domain={[axis.min, 0]}
            ticks={axis.ticks}
            tickFormatter={v => (Number(v) === 0 ? '0%' : formatDrawdown(Number(v)).replace(',0%', '%'))}
          />
          <Tooltip
            cursor={{ stroke: 'var(--muted)', strokeWidth: 1 }}
            content={({ active, payload }) => {
              const row = active ? (payload?.[0]?.payload as ChartRow | undefined) : undefined;
              if (!row) return null;
              return (
                <div style={tooltipBoxStyle}>
                  <div style={{ color: 'var(--muted)', fontSize: 10, marginBottom: 2 }}>{formatDayLabel(row.date)}</div>
                  <div>30d {formatDrawdown(row.dd30)}</div>
                  <div>52w {formatDrawdown(row.dd52)}</div>
                </div>
              );
            }}
          />
          <ReferenceLine
            y={thresholds.amber}
            stroke="var(--amber)"
            strokeDasharray="4 3"
            label={{
              value: `pull DCA forward ${formatDrawdown(thresholds.amber)}`,
              position: 'insideTopLeft',
              fill: 'var(--amber)',
              fontSize: 9,
            }}
          />
          <ReferenceLine
            y={thresholds.red}
            stroke="var(--red)"
            strokeDasharray="4 3"
            label={{
              value: formatDrawdown(thresholds.red),
              position: 'insideTopLeft',
              fill: 'var(--red)',
              fontSize: 9,
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            baseValue={0}
            stroke="var(--accent)"
            strokeWidth={1.6}
            fill="url(#dipGaugeFill)"
            isAnimationActive={false}
            activeDot={{ r: 3.5, fill: 'var(--accent)', stroke: 'none' }}
          />
          {shownBuys.map(b => {
            const level = drawdownLevel(b.dd30 ?? 0, thresholds);
            const color = level === 'neutral' ? 'var(--text)' : drawdownColor(level);
            const selected = b.date === selectedBuyDate;
            return (
              <ReferenceDot
                key={b.date}
                x={dateStrToMs(b.date)}
                y={b[window] ?? 0}
                r={MIN_DOT_RADIUS + ((MAX_DOT_RADIUS - MIN_DOT_RADIUS) * b.amount) / maxAmount}
                fill={color}
                fillOpacity={selected ? 0.95 : 0.5}
                stroke={color}
                strokeWidth={selected ? 2 : 1}
                className="cursor-pointer"
                onClick={() => onSelectBuy(b.date)}
              />
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
