import { NextResponse } from 'next/server';
import { createPasswordResetToken } from '@my-hub/shared/services';

/**
 * Test-only endpoint: creates a password reset token for the given email.
 * Only available in non-production environments to support E2E testing.
 * GET /api/auth/test/reset-token?email=<email>
 */
export async function GET(req: Request) {
  if (process.env['NODE_ENV'] === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  const token = await createPasswordResetToken(email.trim().toLowerCase());
  if (!token) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ token });
}
