'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { Card, ConfirmModal, IconButton, SectionLabel } from '@/components';
import { PencilIcon, TrashIcon } from '@/components/icons';
import { fmt } from '../ui';
import { SupplyModal } from './SupplyModal';
import type { PortfolioOverview, SupplyWithLines } from '@my-hub/shared/services';
import type { SuppliesResponse } from '@/app/api/finances/portfolio/supplies/route';

type SuppliesSectionProps = {
  overview: PortfolioOverview;
  /** Bumped by the parent to trigger a refetch (e.g. after Add Supply). */
  refreshKey: number;
  onChanged: () => void;
};

export function SuppliesSection({ overview, refreshKey, onChanged }: SuppliesSectionProps) {
  const [supplies, setSupplies] = useState<SupplyWithLines[] | null>(null);
  const [editing, setEditing] = useState<SupplyWithLines | null>(null);
  const [deleting, setDeleting] = useState<SupplyWithLines | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const currency = overview.portfolio.baseCurrency;

  const fetchSupplies = useCallback(() => {
    apiFetch<SuppliesResponse>('/api/finances/portfolio/supplies', { silentToast: true })
      .then(res => setSupplies(res.supplies))
      .catch(() => setSupplies([]));
  }, []);

  useEffect(() => {
    fetchSupplies();
  }, [fetchSupplies, refreshKey]);

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await apiFetch(`/api/finances/portfolio/supplies/${deleting.id}`, { method: 'DELETE' });
      setDeleting(null);
      fetchSupplies();
      onChanged();
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <Card className="p-[14px]">
      <SectionLabel>Supplies</SectionLabel>

      {supplies === null && <div className="py-4 text-center text-[12px] text-[var(--muted)]">Loading…</div>}
      {supplies !== null && supplies.length === 0 && (
        <div className="py-4 text-center text-[12px] text-[var(--muted)]">No supplies recorded yet.</div>
      )}

      <div className="flex flex-col gap-2.5">
        {supplies?.map(supply => (
          <div key={supply.id} className="rounded-[10px] border border-[var(--border)] p-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-2.5">
                <span className="text-[12px] font-semibold text-[var(--text)]">{supply.date}</span>
                <span className="text-[12px] font-bold text-[var(--accent)]">{fmt(supply.totalAmount, currency)}</span>
                {supply.notes && <span className="text-[10px] text-[var(--subtle)]">{supply.notes}</span>}
              </div>
              <div className="flex items-center gap-1">
                <IconButton
                  label="Edit supply"
                  variant="ghost"
                  icon={<PencilIcon className="size-3.5" />}
                  onClick={() => setEditing(supply)}
                />
                <IconButton
                  label="Delete supply"
                  variant="ghost"
                  icon={<TrashIcon className="size-3.5" />}
                  onClick={() => setDeleting(supply)}
                />
              </div>
            </div>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-[var(--border)]/50">
                  <th className="pb-1 text-left font-medium text-[var(--muted)]">Ticker</th>
                  <th className="pb-1 text-right font-medium text-[var(--muted)]">Units</th>
                  <th className="pb-1 text-right font-medium text-[var(--muted)]">Price/Unit</th>
                  <th className="pb-1 text-right font-medium text-[var(--muted)]">Fee</th>
                  <th className="pb-1 text-right font-medium text-[var(--muted)]">Total</th>
                </tr>
              </thead>
              <tbody>
                {supply.lines.map(line => (
                  <tr key={line.id}>
                    <td className="py-1 text-[var(--text)]">{line.symbol}</td>
                    <td className="py-1 text-right text-[var(--text)]">
                      {line.units.toLocaleString('de-DE', { maximumFractionDigits: 4 })}
                    </td>
                    <td className="py-1 text-right text-[var(--muted)]">{fmt(line.pricePerUnit, currency)}</td>
                    <td className="py-1 text-right text-[var(--muted)]">{fmt(line.fee, currency)}</td>
                    <td className="py-1 text-right font-medium text-[var(--text)]">
                      {fmt(line.units * line.pricePerUnit + line.fee, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {editing && (
        <SupplyModal
          overview={overview}
          supply={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            fetchSupplies();
            onChanged();
          }}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Delete supply"
          message={`Delete the supply from ${deleting.date} (${fmt(deleting.totalAmount, currency)})? This removes all its lines.`}
          confirmLabel="Delete"
          loading={deleteLoading}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </Card>
  );
}
