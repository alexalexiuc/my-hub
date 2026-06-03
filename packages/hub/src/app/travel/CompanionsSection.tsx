'use client';

import { useState } from 'react';
import { Card } from '@/components';
import { TravelSectionHeader } from './ui';
import type { TripCompanion } from '@my-hub/shared/types';
import { Button, ConfirmModal, SwipeRow } from '@/components';
import { PencilIcon, TrashOutlineIcon } from '@/components/icons';
import { apiFetch } from '@/lib/utils';
import { CompanionModal } from './CompanionModal';

type CompanionsSectionProps = {
  activeTripId: number | null;
  canEdit: boolean;
  companions: TripCompanion[];
  onChanged: () => void;
};

export function CompanionsSection({ activeTripId, canEdit, companions, onChanged }: CompanionsSectionProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCompanion, setEditingCompanion] = useState<TripCompanion | null>(null);
  const [deletingCompanion, setDeletingCompanion] = useState<TripCompanion | null>(null);
  const [openRowId, setOpenRowId] = useState<number | null>(null);

  async function handleDelete() {
    if (!deletingCompanion) return;
    await apiFetch(`/api/travel/companions/${deletingCompanion.id}`, { method: 'DELETE' });
    setDeletingCompanion(null);
    onChanged();
  }

  const headerAction =
    canEdit && activeTripId ? (
      <Button size="xs" variant="accent" onClick={() => setShowAddModal(true)}>
        + Add
      </Button>
    ) : null;

  return (
    <>
      {(showAddModal || editingCompanion) && activeTripId && (
        <CompanionModal
          activeTripId={activeTripId}
          editingCompanion={editingCompanion ?? undefined}
          onClose={() => {
            setShowAddModal(false);
            setEditingCompanion(null);
          }}
          onSaved={() => {
            setShowAddModal(false);
            setEditingCompanion(null);
            onChanged();
          }}
        />
      )}
      {deletingCompanion && (
        <ConfirmModal
          title="Remove Companion"
          message={`Remove "${deletingCompanion.name}" from this trip?`}
          confirmLabel="Remove"
          onConfirm={handleDelete}
          onCancel={() => setDeletingCompanion(null)}
        />
      )}

      <Card className="!p-0 overflow-hidden">
        <TravelSectionHeader title="Companions" action={headerAction} />
        <div className="max-h-64 space-y-1.5 overflow-auto p-4">
          {companions.map(companion => (
            <div key={companion.id} className="overflow-hidden rounded-md border border-[var(--border)]">
              {/* Mobile: swipe-to-reveal */}
              <div data-layout="mobile" className="md:hidden">
                <SwipeRow
                  isOpen={openRowId === companion.id}
                  onOpen={() => setOpenRowId(companion.id)}
                  onClose={() => setOpenRowId(null)}
                  onEdit={canEdit ? () => setEditingCompanion(companion) : undefined}
                  onDelete={canEdit ? () => setDeletingCompanion(companion) : undefined}
                >
                  <div className="bg-[var(--card)] px-3 py-2.5">
                    <p className="text-sm font-medium text-[var(--text)]">{companion.name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {companion.email ?? companion.phone ?? 'No contact info'}
                    </p>
                  </div>
                </SwipeRow>
              </div>

              {/* Desktop: hover buttons */}
              <div
                data-layout="desktop"
                className="group hidden items-center justify-between gap-3 bg-[var(--card)] px-3 py-2.5 md:flex"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--text)]">{companion.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {companion.email ?? companion.phone ?? 'No contact info'}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => setEditingCompanion(companion)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--card3)] hover:text-[var(--accent)]"
                      aria-label="Edit companion"
                    >
                      <PencilIcon className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingCompanion(companion)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--card3)] hover:text-[var(--red)]"
                      aria-label="Remove companion"
                    >
                      <TrashOutlineIcon className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {companions.length === 0 && <p className="text-sm text-[var(--muted)]">No companions yet.</p>}
        </div>
      </Card>
    </>
  );
}
