import { NextResponse } from 'next/server';
import { consumeEmailVerificationToken } from '@my-hub/shared/services';
import { withErrorLogging } from '@/lib/api/with-error-logging';

async function verifyEmailHandler(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const token = (body as Record<string, unknown>)?.token;
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }

  const ok = await consumeEmailVerificationToken(token);
  if (!ok) {
    return NextResponse.json({ error: 'Verification link is invalid or has expired' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export const POST = withErrorLogging(verifyEmailHandler);
