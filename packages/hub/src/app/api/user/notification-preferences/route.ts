import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { getUserSubscriptions, setSubscription, NOTIFICATION_SUBSCRIPTIONS } from '@my-hub/shared/services';
import type { SubscriptionKey } from '@my-hub/shared/services';

const validKeys = new Set<string>(NOTIFICATION_SUBSCRIPTIONS.map(s => s.key));

export const GET = withAuth(async ({ user }) => {
  const subscriptions = await getUserSubscriptions(user.id);
  return NextResponse.json({ subscriptions });
});

export const PUT = withAuth(async ({ req, user }) => {
  const body = await req.json();
  const { key, subscribed } = body as { key: string; subscribed: unknown };

  if (typeof key !== 'string' || !validKeys.has(key)) {
    return NextResponse.json({ error: 'Invalid subscription key' }, { status: 400 });
  }
  if (typeof subscribed !== 'boolean') {
    return NextResponse.json({ error: 'subscribed must be a boolean' }, { status: 400 });
  }

  await setSubscription(user.id, key as SubscriptionKey, subscribed);
  return NextResponse.json({ ok: true });
});
