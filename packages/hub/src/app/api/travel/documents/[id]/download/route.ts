import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { withAuth } from '@/lib/api/with-auth';
import { travelFilesConfig } from '@/lib/travel-files-config';
import { getTripDocumentById } from '@my-hub/shared/services';

export const runtime = 'nodejs';

export const GET = withAuth<{ id: string }>(async ({ user, params }) => {
  const { id } = await params;
  const documentId = Number(id);

  if (!Number.isInteger(documentId) || documentId <= 0) {
    return NextResponse.json({ error: 'Invalid document id' }, { status: 400 });
  }

  const document = await getTripDocumentById(user.id, documentId);
  if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  if (!document.storagePath) {
    return NextResponse.json({ error: 'Document is a link-only entry and has no uploaded file' }, { status: 400 });
  }

  const root = travelFilesConfig.storageRoot;
  const absolutePath = path.join(root, document.storagePath);
  const file = await readFile(absolutePath);

  return new NextResponse(file, {
    headers: {
      'Content-Type': document.mimeType ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${document.originalName ?? document.title}"`,
    },
  });
});
