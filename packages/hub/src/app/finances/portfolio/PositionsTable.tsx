'use client';

import { formatMoney } from '@my-hub/shared/utils';
import { Card, SectionLabel } from '@/components';
import { pct, deviationColor } from '../ui';
import type { PortfolioOverview, PositionOverview } from '@my-hub/shared/services';

type PositionsTableProps = {
  overview: PortfolioOverview;
};

export function PositionsTable({ overview }: PositionsTableProps) {
  const currency = overview.portfolio.baseCurrency;
  const { totals } = overview;

  return (
    <Card className="p-[14px]">
      <SectionLabel>Positions</SectionLabel>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="pb-2 pr-3 text-left font-medium text-[var(--muted)]">Ticker</th>
              <th className="pb-2 px-2 text-right font-medium text-[var(--muted)]">Units</th>
              <th className="pb-2 px-2 text-right font-medium text-[var(--muted)]">Avg Cost</th>
              <th className="pb-2 px-2 text-right font-medium text-[var(--muted)]">Price</th>
              <th className="pb-2 px-2 text-right font-medium text-[var(--muted)]">Value</th>
              <th className="pb-2 px-2 text-right font-medium text-[var(--muted)]">Profit</th>
              <th className="pb-2 px-2 text-right font-medium text-[var(--muted)]">Profit excl. fees</th>
              <th className="pb-2 px-2 text-right font-medium text-[var(--muted)]">Actual %</th>
              <th className="pb-2 px-2 text-right font-medium text-[var(--muted)]">Target %</th>
              <th className="pb-2 px-2 text-right font-medium text-[var(--muted)]">Dev (pp)</th>
              <th className="pb-2 pl-2 text-right font-medium text-[var(--muted)]">Rel. Dev</th>
            </tr>
          </thead>
          <tbody>
            {overview.positions.map(p => (
              <PositionRow key={p.positionId} position={p} currency={currency} />
            ))}
            <tr className="font-semibold">
              <td className="py-2 pr-3 text-[var(--text)]">Totals</td>
              <td className="py-2 px-2" />
              <td className="py-2 px-2" />
              <td className="py-2 px-2" />
              <td className="py-2 px-2 text-right text-[var(--text)]">
                {totals.currentValue !== null ? formatMoney(totals.currentValue, currency) : '—'}
              </td>
              <td
                className="py-2 px-2 text-right"
                style={{ color: deviationColor(totals.profit) }}
                title={pct(totals.profitPct, true)}
              >
                {totals.profit !== null
                  ? `${formatMoney(totals.profit, currency, { signed: true })} (${pct(totals.profitPct, true)})`
                  : '—'}
              </td>
              <td className="py-2 px-2 text-right" style={{ color: deviationColor(totals.profitExclFees) }}>
                {totals.profitExclFees !== null
                  ? `${formatMoney(totals.profitExclFees, currency, { signed: true })} (${pct(totals.profitExclFeesPct, true)})`
                  : '—'}
              </td>
              <td className="py-2 px-2" />
              <td className="py-2 px-2" />
              <td className="py-2 px-2" />
              <td className="py-2 pl-2" />
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PositionRow({ position: p, currency }: { position: PositionOverview; currency: string }) {
  return (
    <tr className="border-b border-[var(--border)]">
      <td className="py-2 pr-3">
        <div className="font-medium text-[var(--text)]">{p.symbol}</div>
        {p.name && <div className="text-[9px] text-[var(--subtle)]">{p.name}</div>}
      </td>
      <td className="py-2 px-2 text-right text-[var(--text)]">
        {p.units.toLocaleString('de-DE', { maximumFractionDigits: 4 })}
      </td>
      <td className="py-2 px-2 text-right text-[var(--muted)]">
        {p.avgUnitCost !== null ? formatMoney(p.avgUnitCost, currency) : '—'}
      </td>
      <td className="py-2 px-2 text-right text-[var(--text)]" title={p.priceDate ? `EOD ${p.priceDate}` : undefined}>
        {p.currentPrice !== null ? formatMoney(p.currentPrice, p.priceCurrency ?? currency) : '—'}
      </td>
      <td className="py-2 px-2 text-right font-medium text-[var(--text)]">
        {p.currentValue !== null ? formatMoney(p.currentValue, currency) : '—'}
      </td>
      <td className="py-2 px-2 text-right" style={{ color: deviationColor(p.profit) }}>
        {p.profit !== null ? `${formatMoney(p.profit, currency, { signed: true })} (${pct(p.profitPct, true)})` : '—'}
      </td>
      <td className="py-2 px-2 text-right" style={{ color: deviationColor(p.profitExclFees) }}>
        {p.profitExclFees !== null
          ? `${formatMoney(p.profitExclFees, currency, { signed: true })} (${pct(p.profitExclFeesPct, true)})`
          : '—'}
      </td>
      <td className="py-2 px-2 text-right text-[var(--text)]">{pct(p.actualAllocationPct)}</td>
      <td className="py-2 px-2 text-right text-[var(--muted)]">{pct(p.targetAllocationPct)}</td>
      <td className="py-2 px-2 text-right" style={{ color: deviationColor(p.allocationDeviationPct) }}>
        {pct(p.allocationDeviationPct, true)}
      </td>
      <td className="py-2 pl-2 text-right text-[var(--muted)]">{pct(p.allocationRelativeDeviationPct, true)}</td>
    </tr>
  );
}
