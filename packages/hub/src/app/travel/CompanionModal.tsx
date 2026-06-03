'use client';

import { useState } from 'react';
import { Modal, Input } from '@/components';
import type { TripCompanion } from '@my-hub/shared/types';
import { FieldCard } from './ui';
import { apiFetch } from '@/lib/utils';

type CompanionModalProps = {
  activeTripId: number;
  editingCompanion?: TripCompanion;
  onClose: () => void;
  onSaved: () => void;
};

export function CompanionModal({ activeTripId, editingCompanion, onClose, onSaved }: CompanionModalProps) {
  const isEdit = !!editingCompanion;
  const [name, setName] = useState(editingCompanion?.name ?? '');
  const [email, setEmail] = useState(editingCompanion?.email ?? '');
  const [phone, setPhone] = useState(editingCompanion?.phone ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (isEdit) {
        await apiFetch(`/api/travel/companions/${editingCompanion.id}`, {
          method: 'PATCH',
          body: { name: name.trim(), email: email.trim() || null, phone: phone.trim() || null },
        });
      } else {
        await apiFetch('/api/travel/companions', {
          method: 'POST',
          body: {
            tripId: activeTripId,
            name: name.trim(),
            email: email.trim() || undefined,
            phone: phone.trim() || undefined,
          },
        });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isEdit ? 'Edit Companion' : 'Add Companion'}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Save' : 'Add'}
      submitDisabled={!name.trim()}
      submitLoading={saving}
      className="md:max-w-[440px]"
    >
      <div className="flex flex-col gap-2.5">
        <FieldCard label="Name *">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Full name"
            variant="ghost"
            autoFocus
            className="w-full text-[13px]"
          />
        </FieldCard>
        <div className="grid grid-cols-2 gap-2.5">
          <FieldCard label="Email">
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="optional"
              variant="ghost"
              className="w-full text-[13px]"
            />
          </FieldCard>
          <FieldCard label="Phone">
            <Input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="optional"
              variant="ghost"
              className="w-full text-[13px]"
            />
          </FieldCard>
        </div>
      </div>
    </Modal>
  );
}
