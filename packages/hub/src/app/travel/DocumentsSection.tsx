'use client';

import { useEffect, useState } from 'react';
import { SectionCard } from '@/components/SectionCard';
import type { TripDocument } from '@my-hub/shared/types';
import type { TripBookingExtended, UploadConfig } from './types';
import { Button, IconButton } from '@/components';
import { DownloadIcon, TrashIcon } from '@/components/icons';
import { apiFetch } from '@/lib/utils';

type DocumentsSectionProps = {
  activeTripId: number | null;
  canEdit: boolean;
  documents: TripDocument[];
  bookings: TripBookingExtended[];
  onChanged: () => void;
};

export function DocumentsSection({ activeTripId, canEdit, documents, bookings, onChanged }: DocumentsSectionProps) {
  const [uploadConfig, setUploadConfig] = useState<UploadConfig>({
    max_mb: 15,
    allowed_mime: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
  });
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentBookingId, setDocumentBookingId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    apiFetch<UploadConfig>('/api/travel/documents/config')
      .then((data) => setUploadConfig(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (documentBookingId === null) return;
    const exists = bookings.some((b) => b.id === documentBookingId);
    if (!exists) setDocumentBookingId(null);
  }, [documentBookingId, bookings]);

  async function uploadDocument() {
    if (!activeTripId || !documentFile || !canEdit) return;
    const maxBytes = uploadConfig.max_mb * 1024 * 1024;
    if (documentFile.size > maxBytes) {
      alert(`File is too large. Max allowed is ${uploadConfig.max_mb} MB.`);
      return;
    }
    if (!uploadConfig.allowed_mime.includes(documentFile.type)) {
      alert(`File type ${documentFile.type} is not allowed.`);
      return;
    }
    const form = new FormData();
    form.append('trip_id', String(activeTripId));
    if (documentBookingId) form.append('booking_id', String(documentBookingId));
    form.append('title', documentTitle.trim() || documentFile.name);
    form.append('type', 'other');
    form.append('file', documentFile);
    setIsUploading(true);
    try {
      await apiFetch('/api/travel/documents/upload', { method: 'POST', body: form });
    } catch {
      return;
    } finally {
      setIsUploading(false);
    }
    setDocumentTitle('');
    setDocumentFile(null);
    setDocumentBookingId(null);
    onChanged();
  }

  async function removeDocument(documentId: number) {
    if (!activeTripId || !canEdit) return;
    await apiFetch(`/api/travel/documents/${documentId}`, { method: 'DELETE' });
    onChanged();
  }

  return (
    <SectionCard title="Documents" className="bg-amber-950/20 border-amber-800/50">
      <div className="space-y-2 mb-3">
        <input
          value={documentTitle}
          onChange={(e) => setDocumentTitle(e.target.value)}
          placeholder="Document title"
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
        />
        <input
          type="file"
          accept={uploadConfig.allowed_mime.join(',')}
          onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)}
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
        />
        <select
          value={documentBookingId ?? ''}
          onChange={(e) => setDocumentBookingId(e.target.value ? Number(e.target.value) : null)}
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
        >
          <option value="">Link to reservation (optional)</option>
          {bookings.map((booking) => (
            <option key={booking.id} value={booking.id}>
              {booking.title}
            </option>
          ))}
        </select>
        <p className="text-xs text-zinc-500">
          Max {uploadConfig.max_mb} MB. Allowed: {uploadConfig.allowed_mime.join(', ')}
        </p>
        <Button
          onClick={uploadDocument}
          disabled={!activeTripId || !documentFile || !canEdit}
          loading={isUploading}
          className="w-full bg-amber-600 hover:bg-amber-500"
        >
          Upload Document
        </Button>
      </div>

      <div className="space-y-2 max-h-64 overflow-auto">
        {documents.map((document) => (
          <div key={document.id} className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium">{document.title}</p>
                <p className="text-xs text-zinc-400">
                  {document.originalName ?? document.sourceUrl ?? 'Link-only document'}
                </p>
                {document.bookingId && (
                  <p className="text-[11px] text-zinc-500">
                    Linked to:{' '}
                    {bookings.find((b) => b.id === document.bookingId)?.title ?? `Reservation #${document.bookingId}`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {document.storagePath && (
                  <a
                    href={`/api/travel/documents/${document.id}/download`}
                    className="rounded-md bg-zinc-800 p-1.5 text-zinc-200 hover:bg-zinc-700"
                    aria-label="Download document"
                    title="Download document"
                  >
                    <DownloadIcon />
                  </a>
                )}
                {canEdit && (
                  <IconButton
                    label="Remove document"
                    onClick={() => removeDocument(document.id)}
                    icon={<TrashIcon />}
                  />
                )}
              </div>
            </div>
          </div>
        ))}
        {documents.length === 0 && <p className="text-sm text-zinc-500">No documents yet.</p>}
      </div>
    </SectionCard>
  );
}
