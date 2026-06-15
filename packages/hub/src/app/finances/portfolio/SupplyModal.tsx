'use client';

import { useRef, useState } from 'react';
import { apiFetch, cn } from '@/lib/utils';
import { FinModalShell } from '../FinModalShell';
import { Button, IconButton, Input, Select, Textarea } from '@/components';
import { TrashIcon } from '@/components/icons';
import { fmt, FinFieldCard } from '../ui';
import { finGhostInputClass, finGhostFieldClass } from '../finances.utils';
import { computeSupplyTotal, type SupplyLineDraft } from './portfolio.utils';
import type { PortfolioOverview, SupplyWithLines } from '@my-hub/shared/services';
import { currentDateString } from '@my-hub/shared/utils';

type SupplyModalProps = {
  overview: PortfolioOverview;
  /** Present = edit mode, absent = add mode. */
  supply?: SupplyWithLines;
  onClose: () => void;
  onSaved: () => void;
};

const EMPTY_LINE: SupplyLineDraft = { positionId: '', units: '', pricePerUnit: '', fee: '0' };

export function SupplyModal({ overview, supply, onClose, onSaved }: SupplyModalProps) {
  const currency = overview.portfolio.baseCurrency;
  const [date, setDate] = useState(supply?.date ?? currentDateString());
  const [notes, setNotes] = useState(supply?.notes ?? '');
  const [lines, setLines] = useState<SupplyLineDraft[]>(
    supply
      ? supply.lines.map(line => ({
          positionId: String(line.positionId),
          units: String(line.units),
          pricePerUnit: String(line.pricePerUnit),
          fee: String(line.fee),
        }))
      : overview.positions.map(p => ({ ...EMPTY_LINE, positionId: String(p.positionId) })),
  );
  const [totalAmount, setTotalAmount] = useState(supply ? String(supply.totalAmount) : '');
  // Total auto-syncs to Σ(units×price+fee) until the user edits it manually.
  const totalTouched = useRef(supply !== undefined);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const computedTotal = computeSupplyTotal(lines);
  const displayedTotal = totalTouched.current ? totalAmount : computedTotal > 0 ? String(computedTotal) : '';

  function patchLine(index: number, patch: Partial<SupplyLineDraft>) {
    setLines(prev => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function parseLines(): { positionId: number; units: number; pricePerUnit: number; fee: number }[] | null {
    const parsed = lines.map(line => ({
      positionId: Number(line.positionId),
      units: Number(line.units),
      pricePerUnit: Number(line.pricePerUnit),
      fee: Number(line.fee) || 0,
    }));
    const valid = parsed.filter(l => l.positionId > 0 && l.units > 0 && l.pricePerUnit > 0 && l.fee >= 0);
    return valid.length > 0 ? valid : null;
  }

  async function handleSubmit() {
    setError(null);
    const parsedLines = parseLines();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('A valid date is required.');
      return;
    }
    if (!parsedLines) {
      setError('At least one complete line (position, units > 0, price > 0) is required.');
      return;
    }
    const total = Number(displayedTotal);
    if (!Number.isFinite(total) || total <= 0) {
      setError('Total amount must be a positive number.');
      return;
    }

    setSaving(true);
    try {
      const body = { date, totalAmount: total, notes: notes.trim() || null, lines: parsedLines };
      if (supply) {
        await apiFetch(`/api/finances/portfolio/supplies/${supply.id}`, { method: 'PUT', body });
      } else {
        await apiFetch('/api/finances/portfolio/supplies', { method: 'POST', body });
      }
      onSaved();
    } catch {
      setSaving(false);
    }
  }

  return (
    <FinModalShell
      onClose={onClose}
      title={supply ? 'Edit Supply' : 'Add Supply'}
      className="md:max-w-[560px]"
      onSubmit={handleSubmit}
      submitLabel="Save"
      submitLoading={saving}
    >
      <div className="flex flex-col gap-3">
        <FinFieldCard label="Date">
          <Input
            variant="ghost"
            className={finGhostInputClass}
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </FinFieldCard>

        <div>
          <div className="mb-1 grid grid-cols-[1fr_72px_88px_64px_28px] gap-1.5 text-[9px] uppercase tracking-[0.07em] text-[var(--subtle)]">
            <span>Position</span>
            <span className="text-right">Units</span>
            <span className="text-right">Price/Unit</span>
            <span className="text-right">Fee</span>
            <span />
          </div>
          <div className="flex flex-col gap-1.5">
            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-[1fr_72px_88px_64px_28px] items-center gap-1.5">
                <Select
                  value={line.positionId}
                  onChange={e => patchLine(i, { positionId: e.target.value })}
                  options={overview.positions.map(p => ({ value: String(p.positionId), label: p.symbol }))}
                  className={finGhostFieldClass}
                >
                  <option value="">Select…</option>
                </Select>
                <Input
                  variant="ghost"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0"
                  value={line.units}
                  onChange={e => patchLine(i, { units: e.target.value })}
                  className="text-right"
                />
                <Input
                  variant="ghost"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={line.pricePerUnit}
                  onChange={e => patchLine(i, { pricePerUnit: e.target.value })}
                  className="text-right"
                />
                <Input
                  variant="ghost"
                  type="number"
                  step="any"
                  min="0"
                  value={line.fee}
                  onChange={e => patchLine(i, { fee: e.target.value })}
                  className="text-right"
                />
                <IconButton
                  label="Remove line"
                  variant="ghost"
                  icon={<TrashIcon className="size-3.5" />}
                  onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))}
                />
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1.5 text-[var(--accent)]"
            onClick={() => setLines(prev => [...prev, { ...EMPTY_LINE }])}
          >
            + Add line
          </Button>
        </div>

        <FinFieldCard label={`Total contributed (lines sum to ${fmt(computedTotal, currency)})`}>
          <Input
            variant="ghost"
            className={finGhostInputClass}
            type="number"
            step="any"
            min="0"
            placeholder="0.00"
            value={displayedTotal}
            onChange={e => {
              totalTouched.current = true;
              setTotalAmount(e.target.value);
            }}
          />
        </FinFieldCard>

        <FinFieldCard label="Notes (optional)">
          <Textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className={cn(finGhostFieldClass, 'w-full resize-none')}
          />
        </FinFieldCard>

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </FinModalShell>
  );
}
