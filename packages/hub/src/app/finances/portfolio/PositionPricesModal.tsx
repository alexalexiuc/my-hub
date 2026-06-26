'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { Collapsible } from '@/components';
import { FinModalShell } from '../FinModalShell';
import { fmt, fmtSign, pct, deviationColor } from '../ui';
import type { PortfolioOverview, PositionOverview, SupplyWithLines } from '@my-hub/shared/services';
import type { SuppliesResponse } from '@/app/api/finances/portfolio/supplies/route';

type PositionPricesModalProps = {
  overview: PortfolioOverview;
  onClose: () => void;
};

type PastBuy = { date: string; units: number; pricePerUnit: number };

const MAX_PAST_BUYS_SHOWN = 5;

/** Most-recent-first buys per positionId, derived from supply lines. */
function groupBuysByPosition(supplies: SupplyWithLines[]): Map<number, PastBuy[]> {
  const byPosition = new Map<number, PastBuy[]>();
  for (const supply of supplies) {
    for (const line of supply.lines) {
      if (line.type !== 'buy') continue;
      const buys = byPosition.get(line.positionId) ?? [];
      buys.push({ date: supply.date, units: line.units, pricePerUnit: line.pricePerUnit });
      byPosition.set(line.positionId, buys);
    }
  }
  for (const buys of byPosition.values()) buys.sort((a, b) => (a.date < b.date ? 1 : -1));
  return byPosition;
}

export function PositionPricesModal({ overview, onClose }: PositionPricesModalProps) {
  const currency = overview.portfolio.baseCurrency;
  const [supplies, setSupplies] = useState<SupplyWithLines[] | null>(null);

  useEffect(() => {
    apiFetch<SuppliesResponse>('/api/finances/portfolio/supplies', { silentToast: true })
      .then(res => setSupplies(res.supplies))
      .catch(() => setSupplies([]));
  }, []);

  const buysByPosition = useMemo(() => groupBuysByPosition(supplies ?? []), [supplies]);

  return (
    <FinModalShell onClose={onClose} title="Current Prices" className="md:max-w-[640px]">
      {supplies === null && (
        <div className="flex h-32 items-center justify-center text-[13px] text-[var(--muted)]">Loading…</div>
      )}
      {supplies !== null && (
        <div className="flex flex-col gap-2">
          {overview.positions.map(position => (
            <PositionPriceCard
              key={position.positionId}
              position={position}
              buys={buysByPosition.get(position.positionId) ?? []}
              currency={currency}
            />
          ))}
        </div>
      )}
    </FinModalShell>
  );
}

function PositionPriceCard({
  position,
  buys,
  currency,
}: {
  position: PositionOverview;
  buys: PastBuy[];
  currency: string;
}) {
  // currentValue is already FX-converted to the base currency, so deriving the
  // per-unit price this way avoids re-converting raw currentPrice (which is in
  // priceCurrency, not necessarily the base currency).
  const currentPriceBase =
    position.currentValue !== null && position.units > 0 ? position.currentValue / position.units : null;
  const lastBuy = buys[0] ?? null;
  const vsLastBuy = currentPriceBase !== null && lastBuy ? currentPriceBase - lastBuy.pricePerUnit : null;
  const vsLastBuyPct = vsLastBuy !== null && lastBuy ? (vsLastBuy / lastBuy.pricePerUnit) * 100 : null;

  return (
    <Collapsible
      label={
        <span className="flex items-baseline gap-1.5">
          <span>{position.symbol}</span>
          {position.name && <span className="text-[10px] font-normal text-[var(--subtle)]">{position.name}</span>}
        </span>
      }
      defaultOpen={false}
      headerClassName="items-start"
      actions={
        <div className="text-right">
          <div className="text-[13px] font-semibold text-[var(--text)]">
            {currentPriceBase !== null ? fmt(currentPriceBase, currency) : '—'}
          </div>
          {vsLastBuy !== null && (
            <div className="text-[9px]" style={{ color: deviationColor(vsLastBuy) }}>
              {fmtSign(vsLastBuy, currency)} ({pct(vsLastBuyPct, true)}) vs last buy
            </div>
          )}
        </div>
      }
    >
      {buys.length === 0 && <p className="text-[11px] text-[var(--muted)]">No buys recorded for this position.</p>}
      {buys.length > 0 && (
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="pb-1.5 pr-3 text-left font-medium text-[var(--muted)]">Date</th>
              <th className="pb-1.5 px-2 text-right font-medium text-[var(--muted)]">Units</th>
              <th className="pb-1.5 px-2 text-right font-medium text-[var(--muted)]">Price/Unit</th>
              <th className="pb-1.5 pl-2 text-right font-medium text-[var(--muted)]">vs Current</th>
            </tr>
          </thead>
          <tbody>
            {buys.slice(0, MAX_PAST_BUYS_SHOWN).map((buy, i) => {
              const diffPct =
                currentPriceBase !== null ? ((currentPriceBase - buy.pricePerUnit) / buy.pricePerUnit) * 100 : null;
              return (
                <tr key={i} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-1 pr-3 text-[var(--text)]">{buy.date}</td>
                  <td className="py-1 px-2 text-right text-[var(--text)]">
                    {buy.units.toLocaleString('de-DE', { maximumFractionDigits: 4 })}
                  </td>
                  <td className="py-1 px-2 text-right text-[var(--muted)]">{fmt(buy.pricePerUnit, currency)}</td>
                  <td className="py-1 pl-2 text-right" style={{ color: deviationColor(diffPct) }}>
                    {pct(diffPct, true)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Collapsible>
  );
}
