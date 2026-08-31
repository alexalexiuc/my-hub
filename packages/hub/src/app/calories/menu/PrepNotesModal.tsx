'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { Modal, Input, Textarea } from '@/components';
import { UpdateMenuDetailsSchema, UpdateMenuDetailsResponseSchema } from '@/app/api/calories/menu/menu.schemas';

type PrepNotesModalProps = {
  menuId: string;
  title: string | null;
  notes: string | null;
  onUpdated: (meta: { title: string | null; notes: string | null }) => void;
  onClose: () => void;
};

/** Title + prep-notes editor, opened from the header's "Prep notes" button. Pre-filled from the
 * current values, so opening it already doubles as the read view. */
export function PrepNotesModal({ menuId, title, notes, onUpdated, onClose }: PrepNotesModalProps) {
  const [draftTitle, setDraftTitle] = useState(title ?? '');
  const [draftNotes, setDraftNotes] = useState(notes ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      // Empty input clears the field rather than storing "", so the read side only ever has to
      // handle null — same convention the MCP tools use.
      const data = await apiFetch(`/api/calories/menu/${menuId}/details`, {
        method: 'PATCH',
        body: { title: draftTitle.trim() || null, notes: draftNotes.trim() || null },
        bodySchema: UpdateMenuDetailsSchema,
        responseSchema: UpdateMenuDetailsResponseSchema,
      });
      onUpdated({ title: data.menu.title, notes: data.menu.notes });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Prep notes"
      onClose={onClose}
      onSubmit={() => void save()}
      submitLabel="Save"
      submitLoading={saving}
      className="md:max-w-sm"
    >
      <div className="flex flex-col gap-3">
        <Input
          value={draftTitle}
          onChange={e => setDraftTitle(e.target.value)}
          placeholder="Menu title, e.g. High protein week"
          className="text-sm"
        />
        <Textarea
          value={draftNotes}
          onChange={e => setDraftNotes(e.target.value)}
          placeholder={
            'Prep notes — what to cook ahead and when.\nSunday: roast 1 kg chicken → Mon lunch + Thu dinner.'
          }
          rows={6}
          className="text-sm"
        />
      </div>
    </Modal>
  );
}
