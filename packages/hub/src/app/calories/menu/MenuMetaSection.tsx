'use client';

import { useState } from 'react';
import { IconButton } from '@/components';
import { ClipboardIcon } from '@/components/icons';
import { PrepNotesModal } from './PrepNotesModal';

type MenuMetaSectionProps = {
  menuId: string;
  title: string | null;
  notes: string | null;
  onUpdated: (meta: { title: string | null; notes: string | null }) => void;
};

/**
 * Header trigger for the menu's own fields — its title and the week's prep notes. Both are
 * normally written by the assistant (`calories_plan_week`, `calories_set_prep_notes`); this
 * button is the Hub's side of them, opening `PrepNotesModal` to view or edit — a prep-notes card
 * is something you read once a week, not something that should sit open on the page permanently.
 */
export function MenuMetaSection({ menuId, title, notes, onUpdated }: MenuMetaSectionProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <IconButton
        label="Prep notes"
        icon={<ClipboardIcon />}
        onClick={() => setShowModal(true)}
        variant="ghost"
        className="flex min-h-11 min-w-11 items-center justify-center text-[var(--muted)] hover:text-[var(--accent)]"
      />
      {showModal && (
        <PrepNotesModal
          menuId={menuId}
          title={title}
          notes={notes}
          onUpdated={onUpdated}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
