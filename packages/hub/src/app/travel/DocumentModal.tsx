'use client';

import { useEffect, useState } from 'react';
import { Modal, Input, FilePicker, Select } from '@/components';
import type { TripBookingExtended, UploadConfig } from './types';
import { FieldCard } from './ui';
import { apiFetch } from '@/lib/utils';

type DocumentModalProps = {
  activeTripId: number;
  bookings: TripBookingExtended[];
  onClose: () => void;
  onSaved: () => void;
};

export function DocumentModal({ activeTripId, bookings, onClose, onSaved }: DocumentModalProps) {
  const [uploadConfig, setUploadConfig] = useState<UploadConfig>({
    maxMb: 15,
    allowedMime: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
  });
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<UploadConfig>('/api/travel/documents/config')
      .then(data => setUploadConfig(data))
      .catch(() => {});
  }, []);

  async function handleSubmit() {
    if (!file) return;
    const maxBytes = uploadConfig.maxMb * 1024 * 1024;
    if (file.size > maxBytes) {
      alert(`File is too large. Max allowed is ${uploadConfig.maxMb} MB.`);
      return;
    }
    if (!uploadConfig.allowedMime.includes(file.type)) {
      alert(`File type ${file.type} is not allowed.`);
      return;
    }
    const form = new FormData();
    form.append('tripId', String(activeTripId));
    if (bookingId) form.append('bookingId', String(bookingId));
    form.append('title', title.trim() || file.name);
    form.append('type', 'other');
    form.append('file', file);
    setSaving(true);
    try {
      await apiFetch('/api/travel/documents/upload', { method: 'POST', body: form });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Upload Document"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Upload"
      submitDisabled={!file}
      submitLoading={saving}
      className="md:max-w-[460px]"
    >
      <div className="flex flex-col gap-2.5">
        <FieldCard label="Title">
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="optional — defaults to filename"
            variant="ghost"
            autoFocus
            className="w-full text-[13px]"
          />
        </FieldCard>
        <FieldCard label="File *">
          <FilePicker
            accept={uploadConfig.allowedMime.join(',')}
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="w-full"
          />
        </FieldCard>
        <FieldCard label="Link to reservation">
          <Select
            options={bookings.map(b => ({ value: b.id, label: b.title }))}
            value={bookingId ?? ''}
            onChange={e => setBookingId(e.target.value ? Number(e.target.value) : null)}
            className="w-full text-[13px]"
          >
            <option value="">None (optional)</option>
          </Select>
        </FieldCard>
        <p className="text-xs text-[var(--muted)]">
          Max {uploadConfig.maxMb} MB · {uploadConfig.allowedMime.join(', ')}
        </p>
      </div>
    </Modal>
  );
}
