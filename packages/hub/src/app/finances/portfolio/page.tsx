'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { Button, Card, IconButton } from '@/components';
import { ClockOutlineIcon, BarChartIcon, GearOutlineIcon, TrendingUpOutlineIcon } from '@/components/icons';
import { AddButton } from '../ui';
import { PortfolioSummaryCards } from './PortfolioSummaryCards';
import { PositionsTable } from './PositionsTable';
import { SuppliesSection } from './SuppliesSection';
import { SupplyModal } from './SupplyModal';
import { PortfolioSettingsModal } from './PortfolioSettingsModal';
import { HistoryModal } from './HistoryModal';
import { ProjectionModal } from './ProjectionModal';
import { PositionPricesModal } from './PositionPricesModal';
import type { PortfolioOverviewResponse } from '@/app/api/finances/portfolio/route';

type OpenModal = 'supply' | 'settings' | 'history' | 'projection' | 'prices' | null;

const HEADER_ICON_BUTTON_CLASS =
  'rounded-full p-1.5 text-[var(--muted)] hover:bg-[var(--card3)] hover:text-[var(--text)]';

export default function PortfolioPage() {
  const [data, setData] = useState<PortfolioOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState<OpenModal>(null);
  const [suppliesRefreshKey, setSuppliesRefreshKey] = useState(0);

  const fetchOverview = useCallback(() => {
    apiFetch<PortfolioOverviewResponse>('/api/finances/portfolio', { silentToast: true })
      .then(setData)
      .catch(() => setData({ exists: false, overview: null }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const overview = data?.overview ?? null;

  function handleSaved() {
    setOpenModal(null);
    fetchOverview();
    setSuppliesRefreshKey(k => k + 1);
  }

  return (
    <div className="flex flex-col gap-[14px]">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-[22px] font-bold tracking-[-0.02em] text-[var(--text)]">Portfolio</div>
        {overview && (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-0.5 rounded-full border border-[var(--border)] bg-[var(--card2)] p-0.5">
              <IconButton
                label="Current prices"
                variant="ghost"
                icon={<TrendingUpOutlineIcon className="size-3.5" />}
                onClick={() => setOpenModal('prices')}
                className={HEADER_ICON_BUTTON_CLASS}
              />
              <IconButton
                label="History"
                variant="ghost"
                icon={<ClockOutlineIcon className="size-3.5" />}
                onClick={() => setOpenModal('history')}
                className={HEADER_ICON_BUTTON_CLASS}
              />
              <IconButton
                label="Projection"
                variant="ghost"
                icon={<BarChartIcon className="size-3.5" />}
                onClick={() => setOpenModal('projection')}
                className={HEADER_ICON_BUTTON_CLASS}
              />
              <IconButton
                label="Settings"
                variant="ghost"
                icon={<GearOutlineIcon className="size-3.5" />}
                onClick={() => setOpenModal('settings')}
                className={HEADER_ICON_BUTTON_CLASS}
              />
            </div>
            <AddButton onClick={() => setOpenModal('supply')} title="Add Supply" />
          </div>
        )}
      </div>

      {loading && <div className="flex h-32 items-center justify-center text-[13px] text-[var(--muted)]">Loading…</div>}

      {/* Empty state — no portfolio yet */}
      {!loading && !overview && (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <div className="text-[15px] font-semibold text-[var(--text)]">Track your ETF portfolio</div>
          <p className="max-w-[420px] text-[12px] text-[var(--muted)]">
            Set up your positions and target allocations, then record monthly supplies. Prices are fetched automatically
            at end of day to show value, profit, and allocation drift.
          </p>
          <Button variant="accent" onClick={() => setOpenModal('settings')}>
            Set up portfolio
          </Button>
        </Card>
      )}

      {overview && (
        <>
          <PortfolioSummaryCards overview={overview} />
          <PositionsTable overview={overview} />
          <SuppliesSection overview={overview} refreshKey={suppliesRefreshKey} onChanged={fetchOverview} />
        </>
      )}

      {openModal === 'supply' && overview && (
        <SupplyModal overview={overview} onClose={() => setOpenModal(null)} onSaved={handleSaved} />
      )}
      {openModal === 'settings' && (
        <PortfolioSettingsModal overview={overview} onClose={() => setOpenModal(null)} onSaved={handleSaved} />
      )}
      {openModal === 'history' && overview && (
        <HistoryModal
          currency={overview.portfolio.baseCurrency}
          targetAmount={overview.portfolio.targetAmount}
          onClose={() => setOpenModal(null)}
        />
      )}
      {openModal === 'projection' && overview && (
        <ProjectionModal overview={overview} onClose={() => setOpenModal(null)} />
      )}
      {openModal === 'prices' && overview && (
        <PositionPricesModal overview={overview} onClose={() => setOpenModal(null)} />
      )}
    </div>
  );
}
