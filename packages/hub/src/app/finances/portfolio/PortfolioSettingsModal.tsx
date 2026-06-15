'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { FinModalShell } from '../FinModalShell';
import { Button, IconButton, Input, Pill, SectionLabel } from '@/components';
import { TrashIcon } from '@/components/icons';
import { FinFieldCard } from '../ui';
import { finGhostInputClass } from '../finances.utils';
import type { PortfolioOverview } from '@my-hub/shared/services';
import { allocationsSumTo100, sumAllocations } from '@my-hub/shared/utils';

type PositionDraft = {
  id?: number;
  symbol: string;
  name: string;
  yahooSymbol: string;
  stooqSymbol: string;
  targetAllocationPct: string;
  hasBuys: boolean;
};

type PortfolioSettingsModalProps = {
  /** null = create mode (no portfolio yet). */
  overview: PortfolioOverview | null;
  onClose: () => void;
  onSaved: () => void;
};

const EMPTY_POSITION: PositionDraft = {
  symbol: '',
  name: '',
  yahooSymbol: '',
  stooqSymbol: '',
  targetAllocationPct: '',
  hasBuys: false,
};

export function PortfolioSettingsModal({ overview, onClose, onSaved }: PortfolioSettingsModalProps) {
  const portfolio = overview?.portfolio ?? null;
  const [positions, setPositions] = useState<PositionDraft[]>(
    overview
      ? overview.positions.map(p => ({
          id: p.positionId,
          symbol: p.symbol,
          name: p.name ?? '',
          yahooSymbol: p.yahooSymbol,
          stooqSymbol: p.stooqSymbol ?? '',
          targetAllocationPct: String(p.targetAllocationPct),
          hasBuys: p.units > 0,
        }))
      : [{ ...EMPTY_POSITION }],
  );
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [pessimistic, setPessimistic] = useState(String(portfolio?.pessimisticAnnualReturnPct ?? 4));
  const [expected, setExpected] = useState(String(portfolio?.expectedAnnualReturnPct ?? 7));
  const [optimistic, setOptimistic] = useState(String(portfolio?.optimisticAnnualReturnPct ?? 10));
  const [contribution, setContribution] = useState(String(portfolio?.plannedMonthlyContribution ?? 0));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const targets = positions.map(p => Number(p.targetAllocationPct) || 0);
  const targetSum = sumAllocations(targets);
  const sumOk = allocationsSumTo100(targets);

  function patchPosition(index: number, patch: Partial<PositionDraft>) {
    setPositions(prev => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function removePosition(index: number) {
    const position = positions[index];
    if (!position || position.hasBuys) return;
    if (position.id) setDeletedIds(prev => [...prev, position.id!]);
    setPositions(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setError(null);
    const parsed = positions.map(p => ({
      id: p.id,
      symbol: p.symbol.trim(),
      name: p.name.trim() || null,
      yahooSymbol: p.yahooSymbol.trim(),
      stooqSymbol: p.stooqSymbol.trim() || null,
      targetAllocationPct: Number(p.targetAllocationPct) || 0,
    }));

    if (parsed.some(p => !p.symbol)) return setError('Every position needs a ticker symbol.');
    if (parsed.some(p => !p.yahooSymbol)) {
      return setError('Every position needs a Yahoo symbol (e.g. SPYL.DE) for price lookups.');
    }
    const symbols = parsed.map(p => p.symbol.toLowerCase());
    if (new Set(symbols).size !== symbols.length) return setError('Position symbols must be unique.');
    if (!sumOk) return setError(`Target allocations must sum to 100% (currently ${targetSum.toFixed(2)}%).`);

    const p = Number(pessimistic);
    const e = Number(expected);
    const o = Number(optimistic);
    const c = Number(contribution);
    if (![p, e, o].every(Number.isFinite)) return setError('Return rates must be numbers.');
    if (!(p <= e && e <= o)) return setError('Returns must satisfy pessimistic ≤ expected ≤ optimistic.');
    if (!Number.isFinite(c) || c < 0) return setError('Monthly contribution must be ≥ 0.');

    const settings = {
      pessimisticAnnualReturnPct: p,
      expectedAnnualReturnPct: e,
      optimisticAnnualReturnPct: o,
      plannedMonthlyContribution: c,
    };
    setSaving(true);
    try {
      if (overview) {
        await apiFetch('/api/finances/portfolio', {
          method: 'PUT',
          body: { settings, positions: parsed, deletePositionIds: deletedIds.length ? deletedIds : undefined },
        });
      } else {
        await apiFetch('/api/finances/portfolio', { method: 'POST', body: { settings, positions: parsed } });
      }
      onSaved();
    } catch {
      setSaving(false);
    }
  }

  return (
    <FinModalShell
      onClose={onClose}
      title={overview ? 'Portfolio Settings' : 'Set up Portfolio'}
      className="md:max-w-[640px]"
      onSubmit={handleSubmit}
      submitLabel="Save"
      submitLoading={saving}
    >
      <div className="flex flex-col gap-4">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <SectionLabel className="mb-0">Positions</SectionLabel>
            <Pill label={`Targets sum: ${targetSum.toFixed(2)}%`} color={sumOk ? 'var(--green)' : 'var(--red)'} />
          </div>
          <div className="mb-1 grid grid-cols-[72px_1fr_92px_84px_64px_28px] gap-1.5 text-[9px] uppercase tracking-[0.07em] text-[var(--subtle)]">
            <span>Ticker</span>
            <span>Name</span>
            <span>Yahoo</span>
            <span>Stooq</span>
            <span className="text-right">Target %</span>
            <span />
          </div>
          <div className="flex flex-col gap-1.5">
            {positions.map((position, i) => (
              <div
                key={position.id ?? `new-${i}`}
                className="grid grid-cols-[72px_1fr_92px_84px_64px_28px] items-center gap-1.5"
              >
                <Input
                  variant="ghost"
                  placeholder="SPYL"
                  value={position.symbol}
                  onChange={e => patchPosition(i, { symbol: e.target.value })}
                />
                <Input
                  variant="ghost"
                  placeholder="SPDR S&P 500 UCITS ETF"
                  value={position.name}
                  onChange={e => patchPosition(i, { name: e.target.value })}
                />
                <Input
                  variant="ghost"
                  placeholder="SPYL.DE"
                  value={position.yahooSymbol}
                  onChange={e => patchPosition(i, { yahooSymbol: e.target.value })}
                />
                <Input
                  variant="ghost"
                  placeholder="spyl.de"
                  value={position.stooqSymbol}
                  onChange={e => patchPosition(i, { stooqSymbol: e.target.value })}
                />
                <Input
                  variant="ghost"
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={position.targetAllocationPct}
                  onChange={e => patchPosition(i, { targetAllocationPct: e.target.value })}
                  className="text-right"
                />
                <IconButton
                  label={position.hasBuys ? 'Cannot delete a position with recorded buys' : 'Remove position'}
                  variant="ghost"
                  icon={<TrashIcon className="size-3.5" />}
                  onClick={() => removePosition(i)}
                  className={position.hasBuys ? 'opacity-30 cursor-not-allowed' : undefined}
                />
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1.5 text-[var(--accent)]"
            onClick={() => setPositions(prev => [...prev, { ...EMPTY_POSITION }])}
          >
            + Add position
          </Button>
        </div>

        <div>
          <SectionLabel>Projection assumptions</SectionLabel>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <FinFieldCard label="Pessimistic %/yr">
              <Input
                variant="ghost"
                className={finGhostInputClass}
                type="number"
                step="any"
                value={pessimistic}
                onChange={e => setPessimistic(e.target.value)}
              />
            </FinFieldCard>
            <FinFieldCard label="Expected %/yr">
              <Input
                variant="ghost"
                className={finGhostInputClass}
                type="number"
                step="any"
                value={expected}
                onChange={e => setExpected(e.target.value)}
              />
            </FinFieldCard>
            <FinFieldCard label="Optimistic %/yr">
              <Input
                variant="ghost"
                className={finGhostInputClass}
                type="number"
                step="any"
                value={optimistic}
                onChange={e => setOptimistic(e.target.value)}
              />
            </FinFieldCard>
            <FinFieldCard label="Monthly contribution">
              <Input
                variant="ghost"
                className={finGhostInputClass}
                type="number"
                step="any"
                min="0"
                value={contribution}
                onChange={e => setContribution(e.target.value)}
              />
            </FinFieldCard>
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </FinModalShell>
  );
}
