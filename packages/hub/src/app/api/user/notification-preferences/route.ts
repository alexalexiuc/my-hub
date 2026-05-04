import { route } from '@/lib/api/route';
import { getUserSubscriptions, setSubscription, NOTIFICATION_SUBSCRIPTIONS } from '@my-hub/shared/services';
import type { SubscriptionKey } from '@my-hub/shared/services';
import { z } from 'zod';

const validKeys = NOTIFICATION_SUBSCRIPTIONS.map(s => s.key) as [string, ...string[]];

const NotificationPreferencePutSchema = z.object({
  key: z.enum(validKeys, { error: 'Invalid subscription key' }),
  subscribed: z.boolean(),
});

export const GET = route(async ({ user }) => {
  const subscriptions = await getUserSubscriptions(user.id);
  return { subscriptions };
});

export const PUT = route({ body: NotificationPreferencePutSchema })(async ({ user, body }) => {
  await setSubscription(user.id, body.key as SubscriptionKey, body.subscribed);
  return { ok: true };
});
