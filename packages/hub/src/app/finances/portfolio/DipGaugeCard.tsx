'use client';

import { useState } from 'react';
import type { DrawdownRange } from '@my-hub/shared/constants';
import { drawdownLevel, formatMoney } from '@my-hub/shared/utils';
import type { PortfolioDrawdown } from '@my-hub/shared/services';
import { Card, DisclosureToggle, SectionLabel } from '@/components';
import { cn } from '@/lib/utils';
import { DipGaugeBreakdown } from './DipGaugeBreakdown';
import { DipGaugeChart } from './DipGaugeChart';
import { SegmentedTabs } from './SegmentedTabs';
import {
  DRAWDOWN_RANGE_OPTIONS,
  DRAWDOWN_WINDOWS,
  drawdownColor,
  formatDayLabel,
  formatDrawdown,
  formatPp,
  isDrawdownStale,
  type DrawdownWindow,
} from './drawdown.utils';

type DipGaugeCardProps = {
  drawdown: PortfolioDrawdown;
  range: DrawdownRange;
  onRangeChange: (range: DrawdownRange) => void;
  currency: string;
};

/** "How far below its recent peak is the portfolio?" — headline drawdown, comparison chips and the drawdown chart. */
export function DipGaugeCard({ drawdown, range, onRangeChange, currency }: DipGaugeCardProps) {
  const [window, setWindow] = useState<DrawdownWindow>('dd30');
  const [selectedBuyDate, setSelectedBuyDate] = useState<string | null>(null);

  const { current, thresholds } = drawdown;
  const level = drawdownLevel(current.dd30, thresholds);
  const stale = isDrawdownStale(drawdown.pricesAsOf, new Date().toISOString().slice(0, 10));
  const selectedBuy = drawdown.buys.find(b => b.date === selectedBuyDate) ?? null;

  return (
    <Card className="p-[14px]">
      <SectionLabel>Dip gauge</SectionLabel>
      <div
        className="text-[40px] font-bold leading-tight tabular-nums"
        style={{ color: drawdownColor(level) }}
        data-testid="dip-gauge-value"
      >
        {formatDrawdown(current.dd30)}
      </div>
      <div className="text-[13px] text-[var(--muted)] tabular-nums">52w {formatDrawdown(current.dd52)}</div>

      <div className="mt-2.5 flex flex-wrap gap-1.5 text-[12px] tabular-nums">
        <Chip>vs yesterday {formatPp(current.dd30 - current.prev.dd30)}</Chip>
        {current.atLastBuy && (
          <Chip>
            vs last buy ({formatDayLabel(current.atLastBuy.date).replace(/ \d{4}$/, '')}){' '}
            {formatPp(current.dd30 - current.atLastBuy.dd30)}
          </Chip>
        )}
      </div>
      <p className={cn('mt-2 text-[11px]', stale ? 'text-[var(--amber)]' : 'text-[var(--muted)]')}>
        Prices as of {formatDayLabel(drawdown.pricesAsOf)}
        {stale && ' (older than the last trading day)'}
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <SegmentedTabs
          label="Drawdown window"
          options={DRAWDOWN_WINDOWS}
          value={window}
          onChange={setWindow}
          className="mb-0"
        />
        <SegmentedTabs
          label="Date range"
          options={DRAWDOWN_RANGE_OPTIONS}
          value={range}
          onChange={onRangeChange}
          className="mb-0"
        />
      </div>

      <div className="mt-2">
        <DipGaugeChart
          drawdown={drawdown}
          window={window}
          selectedBuyDate={selectedBuyDate}
          onSelectBuy={setSelectedBuyDate}
        />
      </div>
      <p className="mt-1 min-h-[18px] text-[11px] text-[var(--muted)] tabular-nums" data-testid="dip-gauge-info">
        {selectedBuy ? (
          <>
            <span className="font-semibold text-[var(--text)]">{formatDayLabel(selectedBuy.date)}</span> ·{' '}
            {formatMoney(selectedBuy.amount, currency)} · dd {formatDrawdown(selectedBuy[window])}
          </>
        ) : (
          'Tap a dot to see a buy. Dot size is the amount, colour is the drawdown that day.'
        )}
      </p>

      <div className="mt-3 border-t border-[var(--border)] pt-2">
        <DisclosureToggle label="Per-ETF breakdown">
          <DipGaugeBreakdown etfs={drawdown.perEtf} currency={currency} />
        </DisclosureToggle>
      </div>
    </Card>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[var(--text)]">{children}</span>
  );
}
