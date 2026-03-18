import { randomBytes } from 'crypto';
import { and, eq, isNull, gt } from 'drizzle-orm';
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

export async function validateInviteToken(token: string): Promise<boolean> {
  const row = await db.query.inviteTokens.findFirst({
    where: eq(inviteTokens.token, token),
  });
  if (!row) return false;
  if (row.usedAt != null) return false;
  if (row.expiresAt != null && row.expiresAt < new Date()) return false;
  return true;
}

export async function consumeInviteToken(token: string, usedBy: string): Promise<void> {
  await db.update(inviteTokens).set({ usedBy, usedAt: new Date() }).where(eq(inviteTokens.token, token));
}

export async function listInviteTokens(createdBy: string): Promise<InviteToken[]> {
  return db.select().from(inviteTokens).where(eq(inviteTokens.createdBy, createdBy)).orderBy(inviteTokens.createdAt);
}

export async function revokeInviteToken(id: string, ownerId: string): Promise<void> {
  await db
    .delete(inviteTokens)
    .where(and(eq(inviteTokens.id, id), eq(inviteTokens.createdBy, ownerId), isNull(inviteTokens.usedAt)));
}
