'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { Button, Input, Textarea, IconButton } from '@/components';
import { ClipboardIcon, PencilIcon } from '@/components/icons';
import { UpdateMenuDetailsSchema, UpdateMenuDetailsResponseSchema } from '@/app/api/calories/menu/menu.schemas';

type MenuMetaSectionProps = {
  menuId: string;
  title: string | null;
  notes: string | null;
  onUpdated: (meta: { title: string | null; notes: string | null }) => void;
};

/**
 * The menu's own fields — its title and the week's prep notes. Both are normally written by the
 * assistant (`calories_plan_week`, `calories_set_prep_notes`); this is the Hub's side of them, so
 * they aren't the one part of the feature you need Claude to touch.
 */
export function MenuMetaSection({ menuId, title, notes, onUpdated }: MenuMetaSectionProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftNotes, setDraftNotes] = useState('');

  function openEdit() {
    setDraftTitle(title ?? '');
    setDraftNotes(notes ?? '');
    setEditing(true);
  }

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
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/5 p-4 flex flex-col gap-3">
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
          rows={5}
          className="text-sm"
        />
        <div className="flex gap-2">
          <Button type="button" variant="neutral" size="sm" onClick={() => setEditing(false)} className="flex-1">
            Cancel
          </Button>
          <Button
            type="button"
            variant="accent"
            size="sm"
            loading={saving}
            onClick={() => void save()}
            className="flex-[2]"
          >
            Save
          </Button>
        </div>
      </div>
    );
  }

  // Nothing stored yet: a single quiet affordance rather than an empty titled card. Keyed on
  // notes alone — a title on its own shows beside the week range, so the card would be empty.
  if (!notes) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={openEdit}
        className="self-start inline-flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--accent)]"
      >
        <ClipboardIcon className="size-3.5" />
        {title ? 'Add prep notes' : 'Add a title or prep notes'}
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/5 p-4 flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-2">
        {/* Always the section's own label — the menu's title is a name the user or Claude chose,
            and rendering it in this uppercase letter-spaced style makes it read as UI chrome.
            It belongs beside the week range instead. */}
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">
          <ClipboardIcon className="size-3.5" />
          Prep notes
        </span>
        <IconButton
          label="Edit title and prep notes"
          icon={<PencilIcon className="size-3.5" />}
          onClick={openEdit}
          variant="ghost"
          className="shrink-0 text-[var(--subtle)] hover:text-[var(--accent)]"
        />
      </div>
      <p className="text-sm text-[var(--text)] whitespace-pre-wrap leading-relaxed">{notes}</p>
    </div>
  );
}
