import { NextResponse } from 'next/server';
import { consumePasswordResetToken } from '@my-hub/shared/services';
import { ResetPasswordSchema } from '@my-hub/shared/schemas';
import { withErrorLogging, formatZodError } from '@/lib/api/with-error-logging';

async function resetPasswordHandler(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = ResetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const ok = await consumePasswordResetToken(parsed.data.token, parsed.data.password);

  if (!ok) {
    return NextResponse.json({ error: 'Reset link is invalid or has expired' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export const POST = withErrorLogging(resetPasswordHandler);
