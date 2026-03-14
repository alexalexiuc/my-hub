import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { users } from '../../db/schema/users';
import type { User } from '../../types/index';

export async function findUserByEmail(email: string): Promise<User | undefined> {
  return db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });
}

export async function upsertUserByEmail(email: string): Promise<User> {
  const normalised = email.toLowerCase();
  const existing = await db.query.users.findFirst({
    where: eq(users.email, normalised),
  });
  if (existing) return existing;

  const [row] = await db.insert(users).values({ email: normalised }).onConflictDoNothing().returning();
  if (!row) throw new Error('Insert did not return a row');
  return row;
}
