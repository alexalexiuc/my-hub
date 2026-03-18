import { randomBytes } from 'crypto';
import { and, eq, isNull, or, gt } from 'drizzle-orm';
import { db } from '../../db/client';
import { inviteTokens } from '../../db/schema/invite-tokens';
import type { InviteToken } from '../../types/index';

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

export async function consumeInviteToken(token: string, usedBy: string): Promise<void> {
  const now = new Date();
  const [row] = await db
    .update(inviteTokens)
    .set({ usedBy, usedAt: now })
    .where(
      and(
        eq(inviteTokens.token, token),
        isNull(inviteTokens.usedAt),
        or(isNull(inviteTokens.expiresAt), gt(inviteTokens.expiresAt, now)),
      ),
    )
    .returning();

  if (!row) {
    throw new Error('Invite token is invalid, expired, or already used');
  }
}

export async function listInviteTokens(createdBy: string): Promise<InviteToken[]> {
  return db.select().from(inviteTokens).where(eq(inviteTokens.createdBy, createdBy)).orderBy(inviteTokens.createdAt);
}

export async function revokeInviteToken(id: string, ownerId: string): Promise<void> {
  await db
    .delete(inviteTokens)
    .where(and(eq(inviteTokens.id, id), eq(inviteTokens.createdBy, ownerId), isNull(inviteTokens.usedAt)));
}
