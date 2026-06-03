'use client';

import { useState } from 'react';
import { Card } from '@/components';
import { TravelSectionHeader } from './ui';
import type { TripChecklistItem } from '@my-hub/shared/types';
import { Button, ConfirmModal, SwipeRow } from '@/components';
import { PencilIcon, TrashOutlineIcon } from '@/components/icons';
import { apiFetch } from '@/lib/utils';
import { ChecklistItemModal } from './ChecklistItemModal';

type ChecklistSectionProps = {
  activeTripId: number | null;
  canEdit: boolean;
  checklist: TripChecklistItem[];
  onChanged: () => void;
};

export function ChecklistSection({ activeTripId, canEdit, checklist, onChanged }: ChecklistSectionProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<TripChecklistItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<TripChecklistItem | null>(null);
  const [openRowId, setOpenRowId] = useState<number | null>(null);

  async function toggleItem(item: TripChecklistItem) {
    if (!activeTripId || !canEdit) return;
    await apiFetch(`/api/travel/checklist/${item.id}`, {
      method: 'PATCH',
      body: { done: !item.done },
    });
    onChanged();
  }

  async function handleDelete() {
    if (!deletingItem) return;
    await apiFetch(`/api/travel/checklist/${deletingItem.id}`, { method: 'DELETE' });
    setDeletingItem(null);
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
      {(showAddModal || editingItem) && activeTripId && (
        <ChecklistItemModal
          activeTripId={activeTripId}
          editingItem={editingItem ?? undefined}
          onClose={() => {
            setShowAddModal(false);
            setEditingItem(null);
          }}
          onSaved={() => {
            setShowAddModal(false);
            setEditingItem(null);
            onChanged();
          }}
        />
      )}
      {deletingItem && (
        <ConfirmModal
          title="Delete Item"
          message={`Delete "${deletingItem.title}"?`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeletingItem(null)}
        />
      )}

      <Card className="!p-0 overflow-hidden">
        <TravelSectionHeader title="Checklist" action={headerAction} />
        <div className="max-h-64 space-y-1.5 overflow-auto p-4">
          {checklist.map(item => (
            <div key={item.id} className="overflow-hidden rounded-md border border-[var(--border)]">
              {/* Mobile: swipe-to-reveal */}
              <div data-layout="mobile" className="md:hidden">
                <SwipeRow
                  isOpen={openRowId === item.id}
                  onOpen={() => setOpenRowId(item.id)}
                  onClose={() => setOpenRowId(null)}
                  onEdit={canEdit ? () => setEditingItem(item) : undefined}
                  onDelete={canEdit ? () => setDeletingItem(item) : undefined}
                  onComplete={canEdit ? () => toggleItem(item) : undefined}
                  completeDone={item.done}
                >
                  <div className={`px-3 py-2.5 text-sm ${item.done ? 'bg-[var(--card2)]' : 'bg-[var(--card)]'}`}>
                    <span className={item.done ? 'text-[var(--subtle)] line-through' : 'text-[var(--text)]'}>
                      {item.title}
                    </span>
                  </div>
                </SwipeRow>
              </div>

              {/* Desktop: hover buttons */}
              <div
                data-layout="desktop"
                className={`group hidden items-center justify-between gap-2 px-3 py-2.5 text-sm md:flex ${
                  item.done ? 'bg-[var(--card2)]' : 'bg-[var(--card)]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleItem(item)}
                  disabled={!canEdit}
                  className={`min-w-0 flex-1 text-left disabled:cursor-default ${
                    item.done ? 'text-[var(--subtle)] line-through' : 'text-[var(--text)]'
                  }`}
                >
                  {item.title}
                </button>
                {canEdit && (
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => setEditingItem(item)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--card3)] hover:text-[var(--accent)]"
                      aria-label="Edit item"
                    >
                      <PencilIcon className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingItem(item)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--card3)] hover:text-[var(--red)]"
                      aria-label="Delete item"
                    >
                      <TrashOutlineIcon className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {checklist.length === 0 && <p className="text-sm text-[var(--muted)]">No checklist items yet.</p>}
        </div>
      </Card>
    </>
  );
}
