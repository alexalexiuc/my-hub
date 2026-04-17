import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { withAuth } from '@/lib/api/with-auth';
import { getTravelFileMaxBytes, travelFilesConfig } from '@/lib/travel-files-config';
import { addTripDocument } from '@my-hub/shared/services';
import type { TripDocumentType } from '@my-hub/shared/types';
import { TripDocumentTypes, tripDocumentTypeValues } from '@my-hub/shared/constants';

export const runtime = 'nodejs';

export const POST = withAuth(async ({ req, user }) => {
  const form = await req.formData();
  const file = form.get('file');
  const tripId = Number(form.get('tripId'));
  const bookingIdRaw = form.get('bookingId');
  const bookingId =
    bookingIdRaw === null || bookingIdRaw === undefined || String(bookingIdRaw) === '' ? null : Number(bookingIdRaw);
  const title = String(form.get('title') ?? '').trim();
  const typeRaw = String(form.get('type') ?? TripDocumentTypes.Other);
  const notes = String(form.get('notes') ?? '').trim();

  if (!Number.isInteger(tripId) || tripId <= 0) {
    return NextResponse.json({ error: 'tripId is required' }, { status: 400 });
  }
  if (bookingId !== null && (!Number.isInteger(bookingId) || bookingId <= 0)) {
    return NextResponse.json({ error: 'bookingId must be a positive integer' }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }

  const maxBytes = getTravelFileMaxBytes();
  if (file.size > maxBytes) {
    return NextResponse.json({ error: `File exceeds max size of ${maxBytes} bytes` }, { status: 400 });
  }

  const { allowedMime } = travelFilesConfig;
  if (!allowedMime.includes(file.type)) {
    return NextResponse.json({ error: `MIME type ${file.type} is not allowed` }, { status: 400 });
  }

  const type = tripDocumentTypeValues.includes(typeRaw as TripDocumentType)
    ? (typeRaw as TripDocumentType)
    : TripDocumentTypes.Other;

  const root = travelFilesConfig.storageRoot;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const docUuid = randomUUID();
  const relativePath = path.join(user.id, String(tripId), `${docUuid}-${safeName}`);
  const absolutePath = path.join(root, relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, buffer);

  let document;
  try {
    document = await addTripDocument(user.id, tripId, {
      type,
      bookingId,
      title: title || file.name,
      notes: notes || null,
      sourceUrl: null,
      originalName: file.name,
      mimeType: file.type,
      byteSize: file.size,
      storagePath: relativePath,
      publicUrl: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload document';
    if (message === 'Trip not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message === 'bookingId does not belong to this trip') {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    throw error;
  }

  return NextResponse.json({ document }, { status: 201 });
});
