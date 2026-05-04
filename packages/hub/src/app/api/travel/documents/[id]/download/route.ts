import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { travelFilesConfig } from '@/lib/travel-files-config';
import { getTripDocumentById } from '@my-hub/shared/services';

export const runtime = 'nodejs';

export const GET = route({ params: z.object({ id: z.coerce.number().int().positive() }) })(async ({ user, params }) => {
  const document = await getTripDocumentById(user.id, params.id);
  if (!document) routeHttpError(404, { error: 'Document not found' });

  if (!document.storagePath) {
    routeHttpError(400, { error: 'Document is a link-only entry and has no uploaded file' });
  }

  const root = travelFilesConfig.storageRoot;
  const absolutePath = path.join(root, document.storagePath);
  const file = await readFile(absolutePath);

  const rawName = (document.originalName ?? document.title ?? 'download').toString();
  // Replace characters that could break the header or enable response splitting
  const safeFilename = rawName.replace(/["\r\n]/g, '_');
  const encodedFilename = encodeURIComponent(rawName);
  const contentDisposition = `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`;

  return new NextResponse(file, {
    headers: {
      'Content-Type': document.mimeType ?? 'application/octet-stream',
      'Content-Disposition': contentDisposition,
    },
  });
});
