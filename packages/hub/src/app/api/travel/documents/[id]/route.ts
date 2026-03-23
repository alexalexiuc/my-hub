import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { deleteTripDocument } from '@my-hub/shared/services';

export const DELETE = withAuth<{ id: string }>(async ({ user, params }) => {
  const { id } = await params;
  const documentId = Number(id);

  if (!Number.isInteger(documentId) || documentId <= 0) {
    return NextResponse.json({ error: 'Invalid document id' }, { status: 400 });
  }

  const document = await deleteTripDocument(user.id, documentId);
  if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  return NextResponse.json({ document });
});
