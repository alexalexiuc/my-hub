import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { route, routeHttpError, created } from '@/lib/api/route';
import { getTravelFileMaxBytes, travelFilesConfig } from '@/lib/travel-files-config';
import { addTripDocument } from '@my-hub/shared/services';
import type { TripDocumentType } from '@my-hub/shared/types';
import { TripDocumentTypes, tripDocumentTypeValues } from '@my-hub/shared/constants';

export const runtime = 'nodejs';

export const POST = route(async ({ req, user }) => {
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
    routeHttpError(400, { error: 'tripId is required' });
  }
  if (bookingId !== null && (!Number.isInteger(bookingId) || bookingId <= 0)) {
    routeHttpError(400, { error: 'bookingId must be a positive integer' });
  }

  if (!(file instanceof File)) {
    routeHttpError(400, { error: 'file is required' });
  }

  const maxBytes = getTravelFileMaxBytes();
  if (file.size > maxBytes) {
    routeHttpError(400, { error: `File exceeds max size of ${maxBytes} bytes` });
  }

  const { allowedMime } = travelFilesConfig;
  if (!allowedMime.includes(file.type)) {
    routeHttpError(400, { error: `MIME type ${file.type} is not allowed` });
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
      routeHttpError(404, { error: message });
    }
    if (message === 'bookingId does not belong to this trip') {
      routeHttpError(400, { error: message });
    }
    throw error;
  }

  return created({ document });
});
