'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { Card, SectionLabel } from '@/components';
import { formatCompact, formatMoney } from '@my-hub/shared/utils';
import type { PortfolioOverview, PositionOverview, SupplyWithLines } from '@my-hub/shared/services';
import { tooltipBoxStyle } from '../ui';
import {
  buildCostBuildup,
  buyPointsForPosition,
  costKey,
  dateStrToMs,
  formatMonthTick,
  formatPriceTick,
  monthTicks,
  niceAxisMax,
  positionColor,
  type BuyPoint,
} from './portfolio.utils';

type PortfolioChartsProps = {
  overview: PortfolioOverview;
  supplies: SupplyWithLines[];
};

const AXIS_TICK = { fill: 'var(--subtle)', fontSize: 9 };
const DAY_MS = 86_400_000;

/** Stacked cost build-up and per-position buy prices, drawn from the recorded supplies. */
export function PortfolioCharts({ overview, supplies }: PortfolioChartsProps) {
  const today = new Date().toISOString().slice(0, 10);
  const endDate = overview.pricesAsOf && overview.pricesAsOf > today ? overview.pricesAsOf : today;
  // Shared time domain so the cost chart and every buy panel line up.
  const domain = useMemo<[number, number]>(() => {
    const first = Math.min(...supplies.map(s => dateStrToMs(s.date)));
    return [first - 10 * DAY_MS, dateStrToMs(endDate) + 10 * DAY_MS];
  }, [supplies, endDate]);
  const ticks = useMemo(() => monthTicks(domain[0], domain[1]), [domain]);

  return (
    <>
      <CostBuildupCard overview={overview} supplies={supplies} endDate={endDate} domain={domain} ticks={ticks} />
      <BuyPricesCard overview={overview} supplies={supplies} domain={domain} ticks={ticks} />
    </>
  );
}

type TimeAxisProps = { domain: [number, number]; ticks: number[] };

function CostBuildupCard({
  overview,
  supplies,
  endDate,
  domain,
  ticks,
}: TimeAxisProps & { overview: PortfolioOverview; supplies: SupplyWithLines[]; endDate: string }) {
  const currency = overview.portfolio.baseCurrency;
  const { positions, totals } = overview;
  const data = useMemo(
    () =>
      buildCostBuildup(
        supplies,
        positions.map(p => p.positionId),
        endDate,
      ),
    [supplies, positions, endDate],
  );
  const last = data.at(-1);
  const totalCost = last ? positions.reduce((sum, p) => sum + (last[costKey(p.positionId)] ?? 0), 0) : 0;
  const value = totals.currentValue;
  const yMax = niceAxisMax(Math.max(totalCost, value ?? 0) * 1.05);

  return (
    <Card className="p-[14px]">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <SectionLabel className="mb-0">Money in vs value now</SectionLabel>
        <Legend
          items={[
            ...positions.map((p, i) => ({ label: p.symbol, color: positionColor(i) })),
            ...(value !== null ? [{ label: 'Value now', color: 'var(--text)', dot: true }] : []),
          ]}
        />
      </div>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 16, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={domain}
              ticks={ticks}
              tickFormatter={formatMonthTick}
              axisLine={false}
              tickLine={false}
              tick={AXIS_TICK}
            />
            <YAxis
              width={40}
              axisLine={false}
              tickLine={false}
              tick={AXIS_TICK}
              tickFormatter={v => formatCompact(Number(v))}
              domain={[0, yMax]}
              ticks={[0, yMax / 4, yMax / 2, (yMax * 3) / 4, yMax]}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const sum = payload.reduce((s, p) => s + (typeof p.value === 'number' ? p.value : 0), 0);
                return (
                  <div style={tooltipBoxStyle}>
                    <div style={{ color: 'var(--muted)', fontSize: 10, marginBottom: 4 }}>
                      {new Date(Number(label)).toISOString().slice(0, 10)}
                    </div>
                    {[...payload].reverse().map(p => (
                      <div key={String(p.dataKey)} style={{ color: p.color as string, marginBottom: 2 }}>
                        {p.name}: {formatMoney(Number(p.value), currency)}
                      </div>
                    ))}
                    <div style={{ marginTop: 4, fontWeight: 600 }}>Total: {formatMoney(sum, currency)}</div>
                  </div>
                );
              }}
            />
            {positions.map((p, i) => (
              <Area
                key={p.positionId}
                type="stepAfter"
                dataKey={costKey(p.positionId)}
                name={p.symbol}
                stackId="cost"
                stroke={positionColor(i)}
                fill={positionColor(i)}
                fillOpacity={0.75}
                strokeWidth={1}
                isAnimationActive={false}
              />
            ))}
            {last && value !== null && (
              <>
                <ReferenceLine
                  segment={[
                    { x: last.t, y: totalCost },
                    { x: last.t, y: value },
                  ]}
                  stroke={value >= totalCost ? 'var(--green)' : 'var(--red)'}
                  strokeWidth={2}
                />
                <ReferenceDot
                  x={last.t}
                  y={value}
                  r={4}
                  fill="var(--text)"
                  stroke="none"
                  label={{
                    value: formatMoney(value, currency),
                    position: 'left',
                    fill: 'var(--text)',
                    fontSize: 10,
                  }}
                />
              </>
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[10px] text-[var(--muted)]">
        Stacked cost of each buy, including fees
        {value !== null && (
          <>
            {' '}
            · value now {formatMoney(value, currency)} vs {formatMoney(totalCost, currency)} in (
            <span style={{ color: value >= totalCost ? 'var(--green)' : 'var(--red)' }}>
              {formatMoney(value - totalCost, currency, { signed: true })}
            </span>
            )
          </>
        )}
      </p>
    </Card>
  );
}

function BuyPricesCard({
  overview,
  supplies,
  domain,
  ticks,
}: TimeAxisProps & { overview: PortfolioOverview; supplies: SupplyWithLines[] }) {
  return (
    <Card className="p-[14px]">
      <SectionLabel>Where each buy landed</SectionLabel>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {overview.positions.map((p, i) => (
          <BuyPricePanel
            key={p.positionId}
            position={p}
            color={positionColor(i)}
            buys={buyPointsForPosition(supplies, p.positionId)}
            currency={overview.portfolio.baseCurrency}
            domain={domain}
            ticks={ticks}
          />
        ))}
      </div>
      <p className="mt-2 text-[10px] text-[var(--muted)]">
        Dot size is the amount of the buy. Dashed line is average cost, solid line is the latest price.
      </p>
    </Card>
  );
}

function BuyPricePanel({
  position,
  color,
  buys,
  currency,
  domain,
  ticks,
}: TimeAxisProps & { position: PositionOverview; color: string; buys: BuyPoint[]; currency: string }) {
  // Latest price in the base currency (the price cache may be in another currency).
  const nowPrice = position.currentValue !== null && position.units > 0 ? position.currentValue / position.units : null;
  const avg = position.avgUnitCost;
  const maxAmount = Math.max(1, ...buys.map(b => b.amount));
  const refs = [avg, nowPrice].filter((v): v is number => v !== null);
  const prices = [...buys.map(b => b.price), ...refs];
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const pad = (hi - lo) * 0.15 || hi * 0.05 || 1;

  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text)]">
        <span className="inline-block size-2.5 rounded-xs" style={{ backgroundColor: color }} />
        {position.symbol}
        <span className="ml-auto text-[10px] font-normal text-[var(--muted)]">
          avg {avg !== null ? formatMoney(avg, currency) : '—'} · now{' '}
          {nowPrice !== null ? formatMoney(nowPrice, currency) : '—'}
        </span>
      </div>
      {buys.length === 0 ? (
        <div className="flex h-[150px] items-center justify-center text-[11px] text-[var(--muted)]">No buys yet</div>
      ) : (
        <div className="h-[150px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={domain}
                ticks={ticks}
                tickFormatter={formatMonthTick}
                axisLine={false}
                tickLine={false}
                tick={AXIS_TICK}
                minTickGap={16}
              />
              <YAxis
                dataKey="price"
                type="number"
                width={40}
                domain={[lo - pad, hi + pad]}
                tickCount={4}
                axisLine={false}
                tickLine={false}
                tick={AXIS_TICK}
                tickFormatter={v => formatPriceTick(Number(v))}
              />
              <ZAxis dataKey="amount" type="number" domain={[0, maxAmount]} range={[20, 220]} />
              <Tooltip
                cursor={false}
                content={({ active, payload }) => {
                  const b = active ? (payload?.[0]?.payload as BuyPoint | undefined) : undefined;
                  if (!b) return null;
                  return (
                    <div style={tooltipBoxStyle}>
                      <div style={{ color: 'var(--muted)', fontSize: 10, marginBottom: 2 }}>{b.date}</div>
                      <div>
                        {b.units.toLocaleString('de-DE', { maximumFractionDigits: 4 })} @{' '}
                        {formatMoney(b.price, currency)}
                      </div>
                      <div style={{ fontWeight: 600 }}>{formatMoney(b.amount, currency)}</div>
                    </div>
                  );
                }}
              />
              {avg !== null && <ReferenceLine y={avg} stroke="var(--muted)" strokeDasharray="4 3" />}
              {nowPrice !== null && <ReferenceLine y={nowPrice} stroke={color} strokeWidth={1.5} />}
              <Scatter data={buys} fill={color} fillOpacity={0.55} stroke={color} isAnimationActive={false} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string; dot?: boolean }[] }) {
  return (
    <span className="flex flex-wrap items-center gap-2.5 text-[9px] text-[var(--muted)]">
      {items.map(item => (
        <span key={item.label} className="flex items-center gap-1">
          <span
            className={item.dot ? 'inline-block size-2 rounded-full' : 'inline-block size-2.5 rounded-xs'}
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </span>
      ))}
    </span>
  );
}
