import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { findOrCreateUser } from '@my-hub/shared/services';
import type { User } from '@my-hub/shared/types';

/** Returns the authenticated DB user, or null if not signed in. */
export async function getAuthUser(): Promise<User | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  try {
    return await findOrCreateUser(session.user.email, session.user.name ?? null);
  } catch {
    return null;
  }
}
