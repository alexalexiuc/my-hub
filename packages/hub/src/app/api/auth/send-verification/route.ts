import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../[...nextauth]/route';
import { findUserByEmail, createVerificationToken } from '@my-hub/shared/services';
import { sendVerificationEmail } from '../../../../lib/email';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await findUserByEmail(session.user.email);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (user.emailVerified) {
    return NextResponse.json({ error: 'Email is already verified' }, { status: 409 });
  }

  const verificationToken = await createVerificationToken(user.id);
  await sendVerificationEmail(user.email, verificationToken.token);

  return NextResponse.json({ ok: true });
}
