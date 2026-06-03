'use client';

import { useState } from 'react';
import { SectionCard } from '@/components/SectionCard';
import type { TripDocument } from '@my-hub/shared/types';
import type { TripBookingExtended } from './types';
import { Button, ConfirmModal, IconButton } from '@/components';
import { DownloadIcon, TrashIcon } from '@/components/icons';
import { apiFetch } from '@/lib/utils';
import { DocumentModal } from './DocumentModal';

type DocumentsSectionProps = {
  activeTripId: number | null;
  canEdit: boolean;
  documents: TripDocument[];
  bookings: TripBookingExtended[];
  onChanged: () => void;
};

export function DocumentsSection({ activeTripId, canEdit, documents, bookings, onChanged }: DocumentsSectionProps) {
  const [showModal, setShowModal] = useState(false);
  const [deletingDocument, setDeletingDocument] = useState<TripDocument | null>(null);

  async function handleDelete() {
    if (!deletingDocument) return;
    await apiFetch(`/api/travel/documents/${deletingDocument.id}`, { method: 'DELETE' });
    setDeletingDocument(null);
    onChanged();
  }

  const headerAction =
    canEdit && activeTripId ? (
      <Button size="xs" variant="accent" onClick={() => setShowModal(true)}>
        Upload
      </Button>
    ) : null;

  return (
    <>
      {showModal && activeTripId && (
        <DocumentModal
          activeTripId={activeTripId}
          bookings={bookings}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            onChanged();
          }}
        />
      )}
      {deletingDocument && (
        <ConfirmModal
          title="Delete Document"
          message={`Delete "${deletingDocument.title}"?`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeletingDocument(null)}
        />
      )}

      <SectionCard title="Documents" className="bg-[var(--card)] border-[var(--border)]" action={headerAction}>
        <div className="max-h-64 space-y-1.5 overflow-auto">
          {documents.map(document => (
            <div
              key={document.id}
              className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--card2)] px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-[var(--text)]">{document.title}</p>
                <p className="truncate text-xs text-[var(--muted)]">
                  {document.originalName ?? document.sourceUrl ?? 'Link-only document'}
                </p>
                {document.bookingId && (
                  <p className="text-[11px] text-[var(--subtle)]">
                    Linked to:{' '}
                    {bookings.find(b => b.id === document.bookingId)?.title ?? `Reservation #${document.bookingId}`}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {document.storagePath && (
                  <a
                    href={`/api/travel/documents/${document.id}/download`}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--card3)] text-[var(--text)] hover:opacity-80"
                    aria-label="Download document"
                  >
                    <DownloadIcon />
                  </a>
                )}
                {canEdit && (
                  <IconButton
                    label="Delete document"
                    onClick={() => setDeletingDocument(document)}
                    icon={<TrashIcon />}
                  />
                )}
              </div>
            </div>
          ))}
          {documents.length === 0 && <p className="text-sm text-[var(--muted)]">No documents yet.</p>}
        </div>
      </SectionCard>
    </>
  );
}
