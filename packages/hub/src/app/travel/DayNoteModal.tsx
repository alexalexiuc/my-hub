'use client';

import { useState } from 'react';
import { Modal, Input, Button, RichTextEditor } from '@/components';
import type { TripDay } from './types';
import { FieldCard } from './ui';
import { formatDayHeading } from '@my-hub/shared/utils';

type DayNoteModalProps = {
  dateStr: string;
  existingNote?: TripDay;
  onClose: () => void;
  onSave: (title: string, notes: string) => Promise<void>;
  onDelete?: () => Promise<void>;
};

export function DayNoteModal({ dateStr, existingNote, onClose, onSave, onDelete }: DayNoteModalProps) {
  const [title, setTitle] = useState(existingNote?.title ?? '');
  const [notes, setNotes] = useState(existingNote?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    try {
      await onSave(title, notes);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      title={`Notes — ${formatDayHeading(dateStr)}`}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Save"
      submitLoading={saving}
      className="md:max-w-[480px]"
    >
      <div className="flex flex-col gap-2.5">
        <FieldCard label="Day title">
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="optional heading for the day"
            variant="ghost"
            autoFocus
            className="w-full text-[13px]"
          />
        </FieldCard>
        <FieldCard label="Notes">
          <RichTextEditor
            value={notes}
            onChange={setNotes}
            placeholder="What's planned for this day…"
            minHeight={220}
            className="w-full"
          />
        </FieldCard>
        {onDelete && existingNote && (
          <div className="flex justify-start">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={handleDelete}
              loading={deleting}
              className="px-0 text-[var(--red)] hover:bg-transparent"
            >
              Delete note
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
