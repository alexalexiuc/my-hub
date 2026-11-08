'use client';

import { formatMoney } from '@my-hub/shared/utils';
import { Fragment, useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { Card, ConfirmModal, IconButton, SectionLabel } from '@/components';
import { PencilIcon, TrashIcon } from '@/components/icons';
import { SupplyModal } from './SupplyModal';
import type { PortfolioOverview, SupplyWithLines } from '@my-hub/shared/services';

type SuppliesSectionProps = {
  overview: PortfolioOverview;
  /** Fetched by the page (shared with the charts); null while loading. */
  supplies: SupplyWithLines[] | null;
  /** Called after an edit or delete so the page refetches overview + supplies. */
  onChanged: () => void;
};

export function SuppliesSection({ overview, supplies, onChanged }: SuppliesSectionProps) {
  const [editing, setEditing] = useState<SupplyWithLines | null>(null);
  const [deleting, setDeleting] = useState<SupplyWithLines | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const currency = overview.portfolio.baseCurrency;

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await apiFetch(`/api/finances/portfolio/supplies/${deleting.id}`, { method: 'DELETE' });
      setDeleting(null);
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

      {supplies !== null && supplies.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="pb-2 pr-3 text-left font-medium text-[var(--muted)]">Ticker</th>
                <th className="pb-2 px-2 text-right font-medium text-[var(--muted)]">Units</th>
                <th className="pb-2 px-2 text-right font-medium text-[var(--muted)]">Price/Unit</th>
                <th className="pb-2 px-2 text-right font-medium text-[var(--muted)]">Fee</th>
                <th className="pb-2 pl-2 text-right font-medium text-[var(--muted)]">Total</th>
              </tr>
            </thead>
            <tbody>
              {supplies.map((supply, i) => (
                <Fragment key={supply.id}>
                  <tr className={i > 0 ? 'border-t border-[var(--border)]' : undefined}>
                    <td colSpan={5} className="pt-2.5 pb-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-baseline gap-2.5">
                          <span className="text-[12px] font-semibold text-[var(--text)]">{supply.date}</span>
                          <span className="text-[12px] font-bold text-[var(--accent)]">
                            {formatMoney(supply.totalAmount, currency)}
                          </span>
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
                    </td>
                  </tr>
                  {supply.lines.map(line => (
                    <tr key={line.id}>
                      <td className="py-1 pr-3 text-[var(--text)]">{line.symbol}</td>
                      <td className="py-1 px-2 text-right text-[var(--text)]">
                        {line.units.toLocaleString('de-DE', { maximumFractionDigits: 4 })}
                      </td>
                      <td className="py-1 px-2 text-right text-[var(--muted)]">
                        {formatMoney(line.pricePerUnit, currency)}
                      </td>
                      <td className="py-1 px-2 text-right text-[var(--muted)]">{formatMoney(line.fee, currency)}</td>
                      <td className="py-1 pl-2 text-right font-medium text-[var(--text)]">
                        {formatMoney(line.units * line.pricePerUnit + line.fee, currency)}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <SupplyModal
          overview={overview}
          supply={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Delete supply"
          message={`Delete the supply from ${deleting.date} (${formatMoney(deleting.totalAmount, currency)})? This removes all its lines.`}
          confirmLabel="Delete"
          loading={deleteLoading}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </Card>
  );
}
