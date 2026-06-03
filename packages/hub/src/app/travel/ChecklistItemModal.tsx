'use client';

import { useState } from 'react';
import { Modal, Input } from '@/components';
import type { TripChecklistItem } from '@my-hub/shared/types';
import { FieldCard } from './ui';

type ChecklistItemModalProps = {
  activeTripId: number;
  editingItem?: TripChecklistItem;
  onClose: () => void;
  onSaved: () => void;
};

export function ChecklistItemModal({ activeTripId, editingItem, onClose, onSaved }: ChecklistItemModalProps) {
  const isEdit = !!editingItem;
  const [title, setTitle] = useState(editingItem?.title ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const { apiFetch } = await import('@/lib/utils');
      if (isEdit) {
        await apiFetch(`/api/travel/checklist/${editingItem.id}`, {
          method: 'PATCH',
          body: { title: title.trim() },
        });
      } else {
        await apiFetch('/api/travel/checklist', {
          method: 'POST',
          body: { tripId: activeTripId, title: title.trim() },
        });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isEdit ? 'Edit Item' : 'Add Item'}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Save' : 'Add'}
      submitDisabled={!title.trim()}
      submitLoading={saving}
      className="md:max-w-[400px]"
    >
      <FieldCard label="Item *">
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Pack passport"
          variant="ghost"
          autoFocus
          className="w-full text-[13px]"
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
      </FieldCard>
    </Modal>
  );
}
