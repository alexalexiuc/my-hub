import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { users } from '../../db/schema/users';
import type { User } from '../../types/index';

export async function findUserByEmail(email: string): Promise<User | undefined> {
  return db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });
}

export async function updateUserName(userId: string, name: string): Promise<User> {
  const [row] = await db
    .update(users)
    .set({ name, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  if (!row) throw new Error('Update did not return a row');
  return row;
}

/** Find user by email, creating them if they don't exist. */
export async function findOrCreateUser(email: string, name?: string | null): Promise<User> {
  const existing = await findUserByEmail(email);
  if (existing) return existing;

  const [row] = await db
    .insert(users)
    .values({ email: email.toLowerCase(), name: name ?? null })
    .returning();
  if (!row) throw new Error('Insert did not return a row');
  return row;
}
