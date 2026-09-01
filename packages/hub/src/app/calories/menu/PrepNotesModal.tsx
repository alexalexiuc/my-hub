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

  // No box around either field: this modal is just two free-text fields, and a bordered/filled
  // `.input` box around each one is chrome the content doesn't need. `scrollable={false}` gives
  // the content area `flex flex-col` (Modal's default `scrollable` path is block-flow, not flex,
  // so a growing child wouldn't have anything to grow against) — the notes field then fills the
  // remaining height itself via `flex-1` instead of sitting in a small fixed-height scroll box
  // above a lot of empty modal.
  return (
    <Modal
      title="Prep notes"
      onClose={onClose}
      onSubmit={() => void save()}
      submitLabel="Save"
      submitLoading={saving}
      scrollable={false}
      className="md:h-[600px] md:max-w-sm"
    >
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        <Input
          value={draftTitle}
          onChange={e => setDraftTitle(e.target.value)}
          placeholder="Menu title, e.g. High protein week"
          className="border-none bg-transparent p-0 text-lg font-bold shadow-none focus:border-none focus:ring-0"
        />
        <Textarea
          value={draftNotes}
          onChange={e => setDraftNotes(e.target.value)}
          placeholder={
            'Prep notes — what to cook ahead and when.\nSunday: roast 1 kg chicken → Mon lunch + Thu dinner.'
          }
          className="flex-1 resize-none border-none bg-transparent p-0 text-sm shadow-none focus:border-none focus:ring-0"
        />
      </div>
    </Modal>
  );
}
