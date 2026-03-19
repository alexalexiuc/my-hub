import { NextResponse } from 'next/server';
import { consumeVerificationToken } from '@my-hub/shared/services';

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { token } = body as { token?: string };

  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }

  const userId = await consumeVerificationToken(token);
  if (!userId) {
    return NextResponse.json({ error: 'Invalid or expired verification token' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
