'use client';

import { useState } from 'react';
import type { MeasurementType } from '@my-hub/shared/types';
import type { MeasurementWithType } from '@my-hub/shared/services';
import { apiFetch } from '@/lib/utils';
import { Card, ConfirmModal } from '@/components';
import { PlusOutlineIcon, PencilIcon, TrashOutlineIcon } from '@/components/icons';
import { MeasurementModal } from './MeasurementModal';
import { formatDateLabel } from './calories.utils';

type MeasurementsSectionProps = {
  latestMeasurements: MeasurementWithType[];
  measurementTypes: MeasurementType[];
  onChanged: () => void;
};

export function MeasurementsSection({ latestMeasurements, measurementTypes, onChanged }: MeasurementsSectionProps) {
  // One question — which modal is open — so it is one piece of state. Two booleans would allow
  // "adding and editing at once", which has no meaning here.
  const [modal, setModal] = useState<'add' | MeasurementWithType | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  async function confirmDelete() {
    if (confirmDeleteId == null) return;
    setDeletingId(confirmDeleteId);
    try {
      await apiFetch(`/api/calories/measurements/${confirmDeleteId}`, { method: 'DELETE' });
      setConfirmDeleteId(null);
      onChanged();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      {modal && (
        <MeasurementModal
          measurementTypes={measurementTypes}
          measurement={modal === 'add' ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            onChanged();
          }}
        />
      )}

      {confirmDeleteId != null && (
        <ConfirmModal
          title="Delete measurement"
          message="Remove this measurement entry?"
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setConfirmDeleteId(null)}
          loading={!!deletingId}
        />
      )}

      <Card className="!p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
            Body measurements
          </h2>
          <button
            type="button"
            onClick={() => setModal('add')}
            className="flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <PlusOutlineIcon className="size-3" />
            Add
          </button>
        </div>

        {latestMeasurements.length === 0 ? (
          <p className="px-5 py-4 text-sm text-[var(--subtle)]">No measurements recorded yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
            {latestMeasurements.map(m => (
              <div
                key={m.id}
                className="group relative rounded-xl border border-[var(--border)] bg-[var(--card2)] px-4 py-3"
              >
                <p className="text-xs text-[var(--muted)]">{m.typeLabel}</p>
                <p className="mt-0.5 text-xl font-bold text-[var(--text)]">
                  {m.value}
                  <span className="ml-1 text-sm font-normal text-[var(--muted)]">{m.typeUnit}</span>
                </p>
                <p className="mt-0.5 text-xs text-[var(--subtle)]">{formatDateLabel(m.date)}</p>
                {m.entrySource !== 'hub' && (
                  <span className="mt-1 inline-block rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
                    {m.entrySource}
                  </span>
                )}
                {/*
                  Visible by default and only hover-gated from `md` up. Revealing these on hover
                  alone left them unreachable on a phone, where there is no hover at all — the
                  entries could be added but never corrected or removed.
                */}
                <div className="absolute right-1.5 top-1.5 flex gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => setModal(m)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--subtle)] hover:bg-[var(--card3)] hover:text-[var(--accent)]"
                    aria-label="Edit measurement"
                  >
                    <PencilIcon className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(m.id)}
                    disabled={deletingId === m.id}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--subtle)] hover:bg-[var(--card3)] hover:text-[var(--red)]"
                    aria-label="Delete measurement"
                  >
                    <TrashOutlineIcon className="size-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
