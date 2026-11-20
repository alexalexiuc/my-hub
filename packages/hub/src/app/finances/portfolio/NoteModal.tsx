'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { FinModalShell } from '../FinModalShell';
import { Input, Select, Textarea } from '@/components';
import { FinFieldCard } from '../ui';
import { finGhostInputClass, finGhostFieldClass } from '../finances.utils';
import { NOTE_KIND_LABELS } from './notes.utils';
import { currentDateString } from '@my-hub/shared/utils';
import { PortfolioNoteKinds, type PortfolioNoteKind } from '@my-hub/shared/constants';
import type { FinancePortfolioNote } from '@my-hub/shared/types';

type NoteModalProps = {
  /** Present = edit mode, absent = add mode. */
  note?: FinancePortfolioNote;
  onClose: () => void;
  onSaved: () => void;
};

const KIND_OPTIONS = Object.values(PortfolioNoteKinds).map(kind => ({ value: kind, label: NOTE_KIND_LABELS[kind] }));

export function NoteModal({ note, onClose, onSaved }: NoteModalProps) {
  const [date, setDate] = useState(note?.date ?? currentDateString());
  const [kind, setKind] = useState<PortfolioNoteKind>(note?.kind ?? PortfolioNoteKinds.Note);
  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('A valid date is required.');
      return;
    }
    if (!body.trim()) {
      setError('Write something first.');
      return;
    }

    setSaving(true);
    try {
      const payload = { date, kind, title: title.trim() || null, body };
      if (note) {
        await apiFetch(`/api/finances/portfolio/notes/${note.id}`, { method: 'PUT', body: payload });
      } else {
        await apiFetch('/api/finances/portfolio/notes', { method: 'POST', body: payload });
      }
      onSaved();
    } catch {
      setSaving(false);
    }
  }

  return (
    <FinModalShell
      onClose={onClose}
      title={note ? 'Edit Note' : 'Add Note'}
      className="md:max-w-[520px]"
      onSubmit={handleSubmit}
      submitLabel="Save"
      submitLoading={saving}
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <FinFieldCard label="Date">
            <Input
              variant="ghost"
              className={finGhostInputClass}
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </FinFieldCard>
          <FinFieldCard label="Kind">
            <Select
              value={kind}
              onChange={e => setKind(e.target.value as PortfolioNoteKind)}
              options={KIND_OPTIONS}
              className={finGhostFieldClass}
            />
          </FinFieldCard>
        </div>
        <FinFieldCard label="Title (optional)">
          <Input
            variant="ghost"
            className={finGhostInputClass}
            placeholder="e.g. Bought the dip too early"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </FinFieldCard>
        <FinFieldCard label="Note">
          <Textarea
            rows={6}
            placeholder="What happened, what you decided and why, what you'd do differently…"
            value={body}
            onChange={e => setBody(e.target.value)}
          />
        </FinFieldCard>
        {error && <div className="text-[12px] text-[var(--red)]">{error}</div>}
      </div>
    </FinModalShell>
  );
}
