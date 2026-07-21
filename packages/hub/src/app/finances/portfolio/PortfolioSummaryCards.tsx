'use client';

import { Card, ProgressBar } from '@/components';
import { fmt, fmtSign } from '../ui';
import type { PortfolioOverview } from '@my-hub/shared/services';
import { currentDateString } from '@my-hub/shared/utils';

type PortfolioSummaryCardsProps = {
  overview: PortfolioOverview;
};

export function PortfolioSummaryCards({ overview }: PortfolioSummaryCardsProps) {
  const { totals, pricesAsOf } = overview;
  const { targetAmount } = overview.portfolio;
  const currency = overview.portfolio.baseCurrency;
  const stale = pricesAsOf !== null && pricesAsOf < currentDateString();

  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
      <SummaryCard
        label="Current Value"
        value={totals.currentValue !== null ? fmt(totals.currentValue, currency) : '—'}
        sub={stale ? `as of ${pricesAsOf}` : null}
        color="var(--accent)"
      />
      <SummaryCard label="Invested" value={fmt(totals.contributed, currency)} color="var(--text)" />
      <SummaryCard
        label="Profit"
        value={totals.profit !== null ? fmtSign(totals.profit, currency) : '—'}
        sub={totals.profitPct !== null ? `${totals.profitPct >= 0 ? '+' : ''}${totals.profitPct.toFixed(2)}%` : null}
        color={totals.profit === null ? 'var(--muted)' : totals.profit >= 0 ? 'var(--green)' : 'var(--red)'}
      />
      <SummaryCard
        label="Profit excl. fees"
        value={totals.profitExclFees !== null ? fmtSign(totals.profitExclFees, currency) : '—'}
        sub={
          totals.profitExclFeesPct !== null
            ? `${totals.profitExclFeesPct >= 0 ? '+' : ''}${totals.profitExclFeesPct.toFixed(2)}%`
            : null
        }
        color={
          totals.profitExclFees === null ? 'var(--muted)' : totals.profitExclFees >= 0 ? 'var(--green)' : 'var(--red)'
        }
      />
      {targetAmount != null && (
        <Card className="col-span-2 p-[14px] md:col-span-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.07em] text-[var(--muted)]">Target progress</span>
            <span className="text-[11px] text-[var(--subtle)]">
              {fmt(totals.currentValue ?? 0, currency)} of {fmt(targetAmount, currency)}
            </span>
          </div>
          <ProgressBar value={totals.currentValue ?? 0} max={targetAmount} color="var(--accent)" thresholds={false} />
        </Card>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string | null;
  color: string;
}) {
  return (
    <Card className="p-[14px]">
      <div className="mb-1 text-[10px] uppercase tracking-[0.07em] text-[var(--muted)]">{label}</div>
      <div className="text-[18px] font-bold tracking-[-0.02em]" style={{ color }}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[10px] text-[var(--subtle)]">{sub}</div>}
    </Card>
  );
}
