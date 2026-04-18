import { NextResponse } from 'next/server';
import { consumePasswordResetToken } from '@my-hub/shared/services';
import { withErrorLogging } from '@/lib/api/with-error-logging';

async function resetPasswordHandler(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { token, password } = body as { token?: string; password?: string };

  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }
  if (!password || typeof password !== 'string') {
    return NextResponse.json({ error: 'password is required' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const ok = await consumePasswordResetToken(token, password);

  if (!ok) {
    return NextResponse.json({ error: 'Reset link is invalid or has expired' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export const POST = withErrorLogging(resetPasswordHandler);
