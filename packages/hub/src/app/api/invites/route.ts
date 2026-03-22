import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { createInviteToken, listInviteTokens } from '@my-hub/shared/services';

export const GET = withAuth(async ({ user }) => {
  const invites = await listInviteTokens(user.id);
  return NextResponse.json({ invites });
});

export const POST = withAuth(async ({ req, user }) => {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // body is optional
  }

  const expiresInDays = typeof body.expiresInDays === 'number' ? body.expiresInDays : undefined;
  const invite = await createInviteToken(user.id, expiresInDays);
  return NextResponse.json({ invite }, { status: 201 });
});
