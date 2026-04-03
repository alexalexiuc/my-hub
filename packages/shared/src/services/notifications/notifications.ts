import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../../db/client';
import { notificationPreferences } from '../../db/schema/notifications';
import { users } from '../../db/schema/users';
import { NOTIFICATION_SUBSCRIPTIONS, type SubscriptionKey } from './config';

export interface UserSubscription {
  key: SubscriptionKey;
  subscribed: boolean;
}

/**
 * Returns the subscription state for all known subscription keys for a user.
 * If a key has no row in the DB, it defaults to subscribed (true).
 */
export async function getUserSubscriptions(userId: string): Promise<UserSubscription[]> {
  const rows = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId));

  const rowMap = new Map(rows.map((r) => [r.subscriptionKey, r.subscribed]));

  return NOTIFICATION_SUBSCRIPTIONS.map(({ key }) => ({
    key,
    subscribed: rowMap.get(key) ?? true,
  }));
}

/**
 * Sets (upserts) the subscription state for a specific key for a user.
 */
export async function setSubscription(userId: string, key: SubscriptionKey, subscribed: boolean): Promise<void> {
  await db
    .insert(notificationPreferences)
    .values({ userId, subscriptionKey: key, subscribed, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [notificationPreferences.userId, notificationPreferences.subscriptionKey],
      set: { subscribed, updatedAt: new Date() },
    });
}

/**
 * Returns the IDs of all active users who are subscribed to a given notification key.
 * A user is subscribed if they have no row (default) OR a row with subscribed=true.
 */
export async function getSubscribedUserIds(subscriptionKey: SubscriptionKey): Promise<string[]> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .leftJoin(
      notificationPreferences,
      and(
        eq(notificationPreferences.userId, users.id),
        eq(notificationPreferences.subscriptionKey, subscriptionKey),
        eq(notificationPreferences.subscribed, false),
      ),
    )
    .where(and(eq(users.active, true), isNull(notificationPreferences.id)));

  return rows.map((r) => r.id);
}
