'use client';

import { useState } from 'react';
import { SectionCard } from '@/components/SectionCard';
import type { TripCompanion } from '@my-hub/shared/types';
import { Button, IconButton } from '@/components';
import { PencilIcon, TrashIcon } from '@/components/icons';
import { apiFetch } from '@/lib/utils';

type CompanionsSectionProps = {
  activeTripId: number | null;
  canEdit: boolean;
  companions: TripCompanion[];
  onChanged: () => void;
};

export function CompanionsSection({ activeTripId, canEdit, companions, onChanged }: CompanionsSectionProps) {
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');

  async function addCompanion() {
    if (!activeTripId || !canEdit || !newName.trim()) return;
    await apiFetch('/api/travel/companions', {
      method: 'POST',
      body: {
        trip_id: activeTripId,
        name: newName.trim(),
        email: newEmail.trim() || undefined,
        phone: newPhone.trim() || undefined,
      },
    });
    setNewName('');
    setNewEmail('');
    setNewPhone('');
    onChanged();
  }

  async function removeCompanion(companionId: number) {
    if (!activeTripId || !canEdit) return;
    await apiFetch(`/api/travel/companions/${companionId}`, { method: 'DELETE' });
    if (editingId === companionId) cancelEdit();
    onChanged();
  }

  function startEdit(companion: TripCompanion) {
    setEditingId(companion.id);
    setEditName(companion.name);
    setEditEmail(companion.email ?? '');
    setEditPhone(companion.phone ?? '');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
    setEditEmail('');
    setEditPhone('');
  }

  async function saveEdit(companionId: number) {
    if (!activeTripId || !canEdit) return;
    const name = editName.trim();
    if (!name) return;
    await apiFetch(`/api/travel/companions/${companionId}`, {
      method: 'PATCH',
      body: { name, email: editEmail.trim() || null, phone: editPhone.trim() || null },
    });
    cancelEdit();
    onChanged();
  }

  return (
    <SectionCard title="Companions" className="bg-fuchsia-950/20 border-fuchsia-800/50">
      <div className="space-y-2 mb-3">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Name"
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Email"
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          />
          <input
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="Phone"
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          />
        </div>
        <Button
          onClick={addCompanion}
          disabled={!activeTripId || !canEdit}
          className="w-full bg-fuchsia-600 hover:bg-fuchsia-500"
        >
          Add Companion
        </Button>
      </div>

      <div className="space-y-2 max-h-64 overflow-auto">
        {companions.map((companion) => (
          <div key={companion.id} className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">
            {editingId === companion.id ? (
              <div className="space-y-2">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Name"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="Email"
                    className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                  />
                  <input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="Phone"
                    className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="xs"
                    onClick={() => saveEdit(companion.id)}
                    className="bg-fuchsia-600 hover:bg-fuchsia-500"
                  >
                    Save
                  </Button>
                  <Button variant="secondary" size="xs" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{companion.name}</p>
                  <p className="text-xs text-zinc-400">{companion.email ?? companion.phone ?? 'No contact info'}</p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1">
                    <IconButton label="Edit companion" onClick={() => startEdit(companion)} icon={<PencilIcon />} />
                    <IconButton
                      label="Remove companion"
                      onClick={() => removeCompanion(companion.id)}
                      icon={<TrashIcon />}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {companions.length === 0 && <p className="text-sm text-zinc-500">No companions yet.</p>}
      </div>
    </SectionCard>
  );
}
