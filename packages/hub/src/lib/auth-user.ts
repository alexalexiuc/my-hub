'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { findUserByEmail } from '@my-hub/shared/services';
import type { User } from '@my-hub/shared/types';
import { PromiseCacheX } from 'promise-cachex';

const AUTH_USER_CACHE_TTL_MS = 60_000;
const authUserByEmailCache = new PromiseCacheX<User | null>({ ttl: AUTH_USER_CACHE_TTL_MS });

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function findAuthUserByEmailCached(email: string): Promise<User | null> {
  const normalizedEmail = normalizeEmail(email);
  return authUserByEmailCache.get(normalizedEmail, async () => {
    try {
      return (await findUserByEmail(normalizedEmail)) ?? null;
    } catch {
      return null;
    }
  });
}

export async function invalidateAuthUserCacheByEmail(email: string): Promise<void> {
  authUserByEmailCache.delete(normalizeEmail(email));
}

/** Returns the authenticated DB user, or null if not signed in or user no longer exists. */
export async function getAuthUser(): Promise<User | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return findAuthUserByEmailCached(session.user.email);
}
