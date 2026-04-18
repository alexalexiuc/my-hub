import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { users } from '../../db/schema/users';
import { hashSecret, verifySecret } from '../../crypto/';
import type { User } from '../../types';

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
    .values({ email: email.toLowerCase(), name: name ?? null, passwordHash })
    .returning();
  if (!row) throw new Error('Insert did not return a row');
  return row;
}

/**
 * Verify email + password credentials.
 * Returns the user on success, null on invalid credentials.
 */
export async function verifyUserPassword(email: string, password: string): Promise<User | null> {
  const user = await findUserByEmail(email);
  if (!user?.passwordHash) return null;
  const ok = await verifySecret(password, user.passwordHash);
  return ok ? user : null;
}

/** Find user by email, creating them if they don't exist. Saves googleId on creation or backfills it if missing. */
export async function findOrCreateUser(email: string, name?: string | null, googleId?: string | null): Promise<User> {
  const normalizedEmail = email.toLowerCase();

  const [inserted] = await db
    .insert(users)
    .values({ email: normalizedEmail, name: name ?? null, googleId: googleId ?? null })
    .onConflictDoNothing({ target: users.email })
    .returning();
  if (inserted) return inserted;

  const existing = await findUserByEmail(normalizedEmail);
  if (!existing) throw new Error('User was not found after conflict handling');

  // Backfill googleId for users who registered via credentials before linking Google
  if (googleId && !existing.googleId) {
    const [updated] = await db
      .update(users)
      .set({ googleId, updatedAt: new Date() })
      .where(eq(users.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  return existing;
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
