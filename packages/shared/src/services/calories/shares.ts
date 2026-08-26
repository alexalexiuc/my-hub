/**
 * Weekly menu sharing — standing owner → recipient shares (view-only), not tied to a
 * specific menuId since a share must cover the owner's current and future weeks.
 *
 * Named exports:
 * - `listMenuShares(ownerUserId)` — who this user has shared their menu with
 * - `listSharedWithMe(viewerUserId)` — who has shared their menu with this user
 * - `createMenuShare(ownerUserId, sharedWithUserId)` — creates a share, or returns the existing one
 * - `deleteMenuShare(ownerUserId, shareId)` — removes a share (owner only)
 * - `hasMenuShareAccess(viewerUserId, ownerUserId)` — read-access check (1s promise cache)
 * - `deleteAllUserWeeklyMenuShares(userId)` — removes all shares where user is owner or recipient (account removal)
 * Types: MenuShareWithUser
 */
import { and, asc, eq, or, sql } from 'drizzle-orm';
import { PromiseCacheX } from 'promise-cachex';
import { db } from '../../db/client';
import { users } from '../../db/schema/users';
import { weeklyMenuShares } from '../../db/schema/calories';
import { WeeklyMenuSharePermissions } from '../../constants';

export type WeeklyMenuShare = typeof weeklyMenuShares.$inferSelect;

const menuShareAccessCache = new PromiseCacheX<boolean>({ ttl: 1000 }); // 1 second

export interface MenuShareWithUser {
  share: WeeklyMenuShare;
  userName: string | null;
  userEmail: string;
}

export async function listMenuShares(ownerUserId: string): Promise<MenuShareWithUser[]> {
  const rows = await db
    .select({
      share: weeklyMenuShares,
      userName: users.name,
      userEmail: users.email,
    })
    .from(weeklyMenuShares)
    .innerJoin(users, eq(users.id, weeklyMenuShares.sharedWithUserId))
    .where(eq(weeklyMenuShares.ownerUserId, ownerUserId))
    .orderBy(asc(users.email));

  return rows.map(row => ({ share: row.share, userName: row.userName, userEmail: row.userEmail }));
}

export async function listSharedWithMe(viewerUserId: string): Promise<MenuShareWithUser[]> {
  const rows = await db
    .select({
      share: weeklyMenuShares,
      userName: users.name,
      userEmail: users.email,
    })
    .from(weeklyMenuShares)
    .innerJoin(users, eq(users.id, weeklyMenuShares.ownerUserId))
    .where(eq(weeklyMenuShares.sharedWithUserId, viewerUserId))
    .orderBy(asc(users.email));

  return rows.map(row => ({ share: row.share, userName: row.userName, userEmail: row.userEmail }));
}

export async function createMenuShare(ownerUserId: string, sharedWithUserId: string): Promise<WeeklyMenuShare> {
  if (ownerUserId === sharedWithUserId) {
    throw new Error('Cannot share with yourself');
  }

  const [row] = await db
    .insert(weeklyMenuShares)
    .values({ ownerUserId, sharedWithUserId, permission: WeeklyMenuSharePermissions.View })
    .onConflictDoNothing()
    .returning();

  if (row) return row;

  const [existing] = await db
    .select()
    .from(weeklyMenuShares)
    .where(and(eq(weeklyMenuShares.ownerUserId, ownerUserId), eq(weeklyMenuShares.sharedWithUserId, sharedWithUserId)));

  if (!existing) throw new Error('Failed to create weekly menu share');
  return existing;
}

export async function deleteMenuShare(ownerUserId: string, shareId: number): Promise<WeeklyMenuShare | null> {
  const [row] = await db
    .delete(weeklyMenuShares)
    .where(and(eq(weeklyMenuShares.id, shareId), eq(weeklyMenuShares.ownerUserId, ownerUserId)))
    .returning();

  if (row) menuShareAccessCache.delete(`${row.sharedWithUserId}:${row.ownerUserId}`);

  return row ?? null;
}

export async function hasMenuShareAccess(viewerUserId: string, ownerUserId: string): Promise<boolean> {
  return menuShareAccessCache.get(`${viewerUserId}:${ownerUserId}`, async () => {
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(weeklyMenuShares)
      .where(and(eq(weeklyMenuShares.ownerUserId, ownerUserId), eq(weeklyMenuShares.sharedWithUserId, viewerUserId)));

    return (row?.count ?? 0) > 0;
  });
}

export async function deleteAllUserWeeklyMenuShares(userId: string): Promise<number> {
  const rows = await db
    .delete(weeklyMenuShares)
    .where(or(eq(weeklyMenuShares.ownerUserId, userId), eq(weeklyMenuShares.sharedWithUserId, userId)))
    .returning({ id: weeklyMenuShares.id });

  return rows.length;
}
