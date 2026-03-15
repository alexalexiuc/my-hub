import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { users } from '../../db/schema/users';
import type { User } from '../../types/index';

export async function findUserByEmail(email: string): Promise<User | undefined> {
  return db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });
}
