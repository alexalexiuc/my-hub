import { eq, inArray, isNull, and, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { users } from '../../db/schema/users';
import { hashSecret, verifySecret } from '../../crypto/';
import type { User } from '../../types';
import { MAX_FAILED_LOGIN_ATTEMPTS } from '../../constants/auth';
import { generateEmailVerificationToken, verifyEmailVerificationToken } from './email-verification-token';

export async function findUserByEmail(email: string): Promise<User | undefined> {
  return db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });
}

export async function findUserById(userId: string): Promise<User | undefined> {
  return db.query.users.findFirst({
    where: eq(users.id, userId),
  });
}

export async function findUsersByEmails(emails: string[]): Promise<User[]> {
  const normalized = [...new Set(emails.map(email => email.trim().toLowerCase()).filter(Boolean))];
  if (normalized.length === 0) return [];

  return db.select().from(users).where(inArray(users.email, normalized));
}

export async function updateUserName(userId: string, name: string): Promise<User> {
  const [row] = await db.update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
  if (!row) throw new Error('Update did not return a row');
  return row;
}

/**
 * Register a new user with an email + password.
 * Throws if the email is already taken.
 */
export async function createUserWithPassword(email: string, password: string, name?: string | null): Promise<User> {
  const existing = await findUserByEmail(email);
  if (existing) throw new Error('Email already registered');

  const passwordHash = await hashSecret(password);
  const [row] = await db
    .insert(users)
    .values({ email: email.toLowerCase(), name: name ?? null, passwordHash, emailVerified: false })
    .returning();
  if (!row) throw new Error('Insert did not return a row');
  return row;
}

/**
 * Verify email + password credentials.
 * Returns the user on success, null on invalid credentials.
 * Increments failedLoginAttempts on failure; resets to 0 on success; blocks at MAX_FAILED_LOGIN_ATTEMPTS.
 */
export async function verifyUserPassword(email: string, password: string): Promise<User | null> {
  const user = await findUserByEmail(email);
  if (!user?.passwordHash) return null;

  if (user.blockedAt) return null;

  const ok = await verifySecret(password, user.passwordHash);

  if (ok) {
    if (user.failedLoginAttempts > 0) {
      await db.update(users).set({ failedLoginAttempts: 0, updatedAt: new Date() }).where(eq(users.id, user.id));
    }
    return user;
  }

  await db
    .update(users)
    .set({
      failedLoginAttempts: sql`${users.failedLoginAttempts} + 1`,
      blockedAt: sql`CASE WHEN ${users.failedLoginAttempts} + 1 >= ${MAX_FAILED_LOGIN_ATTEMPTS} THEN NOW() ELSE ${users.blockedAt} END`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return null;
}

/** Find user by email, creating them if they don't exist. Marks email as verified for Google OAuth users. */
export async function findOrCreateUser(email: string, name?: string | null, googleId?: string | null): Promise<User> {
  const normalizedEmail = email.toLowerCase();

  const [inserted] = await db
    .insert(users)
    .values({ email: normalizedEmail, name: name ?? null, googleId: googleId ?? null, emailVerified: true })
    .onConflictDoNothing({ target: users.email })
    .returning();
  if (inserted) return inserted;

  const existing = await findUserByEmail(normalizedEmail);
  if (!existing) throw new Error('User was not found after conflict handling');

  // Backfill googleId and mark email verified for users who linked Google to an existing account
  if (googleId && (!existing.googleId || !existing.emailVerified)) {
    const patch: Partial<typeof users.$inferInsert> = { updatedAt: new Date(), emailVerified: true };
    if (!existing.googleId) patch.googleId = googleId;
    const [updated] = await db.update(users).set(patch).where(eq(users.id, existing.id)).returning();
    return updated ?? existing;
  }

  return existing;
}

/**
 * Backfill the googleId on an existing user record and mark email as verified.
 * No-op if the user already has a googleId set.
 */
export async function backfillUserGoogleId(userId: string, googleId: string): Promise<void> {
  await db
    .update(users)
    .set({ googleId, emailVerified: true, updatedAt: new Date() })
    .where(and(eq(users.id, userId), isNull(users.googleId)));
}

/** Update a user's profile fields (name, country, timezone). Only provided fields are updated. */
export async function updateUserProfile(
  userId: string,
  data: { name?: string | null; country?: string | null; timezone?: string | null },
): Promise<User> {
  const patch: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  if (data.name !== undefined) patch.name = data.name;
  if (data.country !== undefined) patch.country = data.country;
  if (data.timezone !== undefined) patch.timezone = data.timezone;

  const [row] = await db.update(users).set(patch).where(eq(users.id, userId)).returning();
  if (!row) throw new Error('Update did not return a row');
  return row;
}

/**
 * Directly marks a user's email as verified (for use in seeds and admin operations).
 */
export async function verifyUserEmail(userId: string): Promise<void> {
  await db
    .update(users)
    .set({
      emailVerified: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

/**
 * Generates a stateless HMAC email verification token for the given user.
 * No DB write — token embeds userId and expiry, signed with EMAIL_VERIFICATION_SECRET.
 */
export async function createEmailVerificationToken(userId: string): Promise<string> {
  return generateEmailVerificationToken(userId);
}

/**
 * Verifies an email verification token and marks the user's email as verified.
 * Returns true if the token was valid and unexpired, false otherwise.
 */
export async function consumeEmailVerificationToken(token: string): Promise<boolean> {
  const result = await verifyEmailVerificationToken(token);
  if (!result) return false;

  await db.update(users).set({ emailVerified: true, updatedAt: new Date() }).where(eq(users.id, result.userId));

  return true;
}
