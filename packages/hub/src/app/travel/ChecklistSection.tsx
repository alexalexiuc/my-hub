'use client';

import { useState } from 'react';
import { SectionCard } from '@/components/SectionCard';
import type { TripChecklistItem } from '@my-hub/shared/types';
import { Button, IconButton, Input } from '@/components';
import { PencilIcon, TrashIcon } from '@/components/icons';
import { apiFetch } from '@/lib/utils';

type ChecklistSectionProps = {
  activeTripId: number | null;
  canEdit: boolean;
  checklist: TripChecklistItem[];
  onChanged: () => void;
};

export function ChecklistSection({ activeTripId, canEdit, checklist, onChanged }: ChecklistSectionProps) {
  const [newItem, setNewItem] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');

  async function addItem() {
    if (!activeTripId || !canEdit || !newItem.trim()) return;
    await apiFetch('/api/travel/checklist', {
      method: 'POST',
      body: { tripId: activeTripId, title: newItem.trim() },
    });
    setNewItem('');
    onChanged();
  }

  async function toggleItem(item: TripChecklistItem) {
    if (!activeTripId || !canEdit) return;
    await apiFetch(`/api/travel/checklist/${item.id}`, {
      method: 'PATCH',
      body: { done: !item.done },
    });
    onChanged();
  }

  async function removeItem(itemId: number) {
    if (!activeTripId || !canEdit) return;
    await apiFetch(`/api/travel/checklist/${itemId}`, { method: 'DELETE' });
    onChanged();
  }

  function startEdit(item: TripChecklistItem) {
    setEditingId(item.id);
    setEditTitle(item.title);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle('');
  }

  async function saveEdit(itemId: number) {
    if (!activeTripId || !canEdit || !editTitle.trim()) return;
    await apiFetch(`/api/travel/checklist/${itemId}`, {
      method: 'PATCH',
      body: { title: editTitle.trim() },
    });
    cancelEdit();
    onChanged();
  }

  return (
    <SectionCard title="Checklist" className="bg-teal-950/20 border-teal-800/50">
      <div className="flex gap-2 mb-3">
        <Input
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          placeholder="Add checklist item"
          className="flex-1"
        />
        <Button onClick={addItem} disabled={!activeTripId || !canEdit} className="bg-teal-600 hover:bg-teal-500">
          Add
        </Button>
      </div>

      <div className="space-y-2 max-h-64 overflow-auto">
        {checklist.map(item => (
          <div
            key={item.id}
            className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
              item.done ? 'border-emerald-700 bg-emerald-900/20 text-zinc-400' : 'border-zinc-700 bg-zinc-900'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              {editingId === item.id ? (
                <>
                  <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="min-w-0 flex-1" />
                  <Button size="xs" onClick={() => saveEdit(item.id)} className="bg-teal-600 hover:bg-teal-500">
                    Save
                  </Button>
                  <Button variant="secondary" size="xs" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => toggleItem(item)}
                    disabled={!canEdit}
                    className={`min-w-0 flex-1 text-left px-0 py-0 font-normal hover:bg-transparent ${item.done ? 'line-through' : ''} disabled:cursor-default`}
                  >
                    {item.title}
                  </Button>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <IconButton label="Edit checklist item" onClick={() => startEdit(item)} icon={<PencilIcon />} />
                      <IconButton
                        label="Remove checklist item"
                        onClick={() => removeItem(item.id)}
                        icon={<TrashIcon />}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        {checklist.length === 0 && <p className="text-sm text-zinc-500">No checklist items yet.</p>}
      </div>
    </SectionCard>
  );
}
