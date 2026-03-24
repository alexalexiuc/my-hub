import { randomBytes } from 'crypto';
import { and, eq, isNull, or, gt } from 'drizzle-orm';
import { db } from '../../db/client';
import { inviteTokens } from '../../db/schema/invite-tokens';
import { users } from '../../db/schema/users';
import type { InviteToken, InviteTokenWithUsedByEmail } from '../../types/index';

export async function createInviteToken(createdBy: string, expiresInDays?: number): Promise<InviteToken> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = expiresInDays != null ? new Date(Date.now() + expiresInDays * 86_400_000) : null;
  const [row] = await db.insert(inviteTokens).values({ token, createdBy, expiresAt }).returning();
  if (!row) throw new Error('Insert did not return a row');
  return row;
}

/**
 * Atomically claim an invite token: marks it as used in a single UPDATE with all
 * validity conditions in the WHERE clause. Returns true if the token was valid and
 * is now claimed, false if it was missing, already used, or expired.
 * Because claim and validation are one statement there is no TOCTOU race.
 */
export async function claimInviteToken(token: string): Promise<boolean> {
  const now = new Date();
  const rows = await db
    .update(inviteTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(inviteTokens.token, token),
        isNull(inviteTokens.usedAt),
        or(isNull(inviteTokens.expiresAt), gt(inviteTokens.expiresAt, now)),
      ),
    )
    .returning({ id: inviteTokens.id });
  return rows.length > 0;
}

/**
 * After a user is successfully created, record which user consumed the token.
 * This is best-effort — the token was already atomically claimed by claimInviteToken,
 * so even if this update fails the invite cannot be reused.
 */
export async function bindInviteTokenToUser(token: string, userId: string): Promise<void> {
  await db.update(inviteTokens).set({ usedBy: userId }).where(eq(inviteTokens.token, token));
}

export async function listInviteTokens(createdBy: string): Promise<InviteTokenWithUsedByEmail[]> {
  const rows = await db
    .select({
      id: inviteTokens.id,
      token: inviteTokens.token,
      createdBy: inviteTokens.createdBy,
      usedBy: inviteTokens.usedBy,
      usedAt: inviteTokens.usedAt,
      expiresAt: inviteTokens.expiresAt,
      createdAt: inviteTokens.createdAt,
      usedByEmail: users.email,
    })
    .from(inviteTokens)
    .leftJoin(users, eq(inviteTokens.usedBy, users.id))
    .where(eq(inviteTokens.createdBy, createdBy))
    .orderBy(inviteTokens.createdAt);
  return rows;
}

export async function revokeInviteToken(id: string, ownerId: string): Promise<void> {
  await db
    .delete(inviteTokens)
    .where(and(eq(inviteTokens.id, id), eq(inviteTokens.createdBy, ownerId), isNull(inviteTokens.usedAt)));
}
