'use client';

import { useEffect, useState } from 'react';
import { SectionCard } from '@/components/SectionCard';
import type { TripDocument } from '@my-hub/shared/types';
import type { TripBookingExtended, UploadConfig } from './types';
import { Button, FilePicker, IconButton, Input, Select } from '@/components';
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
    maxMb: 15,
    allowedMime: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
  });
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentBookingId, setDocumentBookingId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    apiFetch<UploadConfig>('/api/travel/documents/config')
      .then(data => setUploadConfig(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (documentBookingId === null) return;
    const exists = bookings.some(b => b.id === documentBookingId);
    if (!exists) setDocumentBookingId(null);
  }, [documentBookingId, bookings]);

  async function uploadDocument() {
    if (!activeTripId || !documentFile || !canEdit) return;
    const maxBytes = uploadConfig.maxMb * 1024 * 1024;
    if (documentFile.size > maxBytes) {
      alert(`File is too large. Max allowed is ${uploadConfig.maxMb} MB.`);
      return;
    }
    if (!uploadConfig.allowedMime.includes(documentFile.type)) {
      alert(`File type ${documentFile.type} is not allowed.`);
      return;
    }
    const form = new FormData();
    form.append('tripId', String(activeTripId));
    if (documentBookingId) form.append('bookingId', String(documentBookingId));
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
        <Input value={documentTitle} onChange={e => setDocumentTitle(e.target.value)} placeholder="Document title" />
        <FilePicker
          accept={uploadConfig.allowedMime.join(',')}
          onChange={e => setDocumentFile(e.target.files?.[0] ?? null)}
        />
        <Select
          options={bookings.map(b => ({ value: b.id, label: b.title }))}
          value={documentBookingId ?? ''}
          onChange={e => setDocumentBookingId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Link to reservation (optional)</option>
        </Select>
        <p className="text-xs text-zinc-500">
          Max {uploadConfig.maxMb} MB. Allowed: {uploadConfig.allowedMime.join(', ')}
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
        {documents.map(document => (
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
                    {bookings.find(b => b.id === document.bookingId)?.title ?? `Reservation #${document.bookingId}`}
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
