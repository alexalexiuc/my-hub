'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { Card, ConfirmModal, IconButton, SectionLabel } from '@/components';
import { PencilIcon, TrashIcon } from '@/components/icons';
import { AddButton } from '../ui';
import { NoteModal } from './NoteModal';
import { NOTE_KIND_LABELS } from './notes.utils';
import type { PortfolioNotesResponse } from '@/app/api/finances/portfolio/notes/route';
import type { FinancePortfolioNote } from '@my-hub/shared/types';

/** Journal of decisions, lessons and market context that Claude can read through the finances MCP. */
export function NotesSection() {
  const [notes, setNotes] = useState<FinancePortfolioNote[] | null>(null);
  const [editing, setEditing] = useState<FinancePortfolioNote | 'new' | null>(null);
  const [deleting, setDeleting] = useState<FinancePortfolioNote | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchNotes = useCallback(() => {
    apiFetch<PortfolioNotesResponse>('/api/finances/portfolio/notes', { silentToast: true })
      .then(res => setNotes(res.notes))
      .catch(() => setNotes([]));
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await apiFetch(`/api/finances/portfolio/notes/${deleting.id}`, { method: 'DELETE' });
      setDeleting(null);
      fetchNotes();
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <Card className="p-[14px]">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>Notes</SectionLabel>
        <AddButton onClick={() => setEditing('new')} title="Add Note" />
      </div>

      {notes === null && <div className="py-4 text-center text-[12px] text-[var(--muted)]">Loading…</div>}
      {notes !== null && notes.length === 0 && (
        <div className="py-4 text-center text-[12px] text-[var(--muted)]">
          No notes yet. Jot down why you bought or waited — Claude can read them when you ask about your portfolio.
        </div>
      )}

      {notes !== null && notes.length > 0 && (
        <div className="flex flex-col">
          {notes.map((note, i) => (
            <div
              key={note.id}
              className={i > 0 ? 'border-t border-[var(--border)] py-2.5' : 'pb-2.5 pt-1'}
              data-testid="portfolio-note"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="text-[12px] font-semibold text-[var(--text)]">{note.date}</span>
                  <span className="rounded-full bg-[var(--card3)] px-2 py-0.5 text-[10px] text-[var(--muted)]">
                    {NOTE_KIND_LABELS[note.kind]}
                  </span>
                  {note.title && <span className="truncate text-[12px] text-[var(--text)]">{note.title}</span>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <IconButton
                    label="Edit note"
                    variant="ghost"
                    icon={<PencilIcon className="size-3.5" />}
                    onClick={() => setEditing(note)}
                  />
                  <IconButton
                    label="Delete note"
                    variant="ghost"
                    icon={<TrashIcon className="size-3.5" />}
                    onClick={() => setDeleting(note)}
                  />
                </div>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-[12px] text-[var(--muted)]">{note.body}</p>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <NoteModal
          note={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            fetchNotes();
          }}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Delete note"
          message={`Delete the note from ${deleting.date}?`}
          confirmLabel="Delete"
          loading={deleteLoading}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </Card>
  );
}
