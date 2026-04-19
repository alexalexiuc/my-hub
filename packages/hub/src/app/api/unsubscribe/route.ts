import { type NextRequest, NextResponse } from 'next/server';
import { verifyUnsubscribeToken, setSubscription } from '@my-hub/shared/services';
import { NOTIFICATION_SUBSCRIPTIONS, type SubscriptionKey } from '@my-hub/shared/constants';

const validKeys = new Set<string>(NOTIFICATION_SUBSCRIPTIONS.map(s => s.key));

function htmlResponse(body: string, status: number): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Unsubscribe</title>
<style>body{font-family:system-ui,sans-serif;background:#0d1b2a;color:#e4eaf2;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{background:#13283d;border:1px solid #1e3a52;border-radius:12px;padding:40px;max-width:420px;text-align:center}
h1{margin:0 0 12px;font-size:20px}p{margin:0;color:#8ca0b5;font-size:14px}a{color:#3b82f6}</style>
</head><body><div class="card">${body}</div></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  const result = await verifyUnsubscribeToken(token);

  if (!result || !validKeys.has(result.subscriptionKey)) {
    return htmlResponse(
      '<h1>Link expired or invalid</h1><p>This unsubscribe link is no longer valid. You can manage your notification preferences from your <a href="/profile">Profile</a>.</p>',
      400,
    );
  }

  await setSubscription(result.userId, result.subscriptionKey as SubscriptionKey, false);

  const sub = NOTIFICATION_SUBSCRIPTIONS.find(s => s.key === result.subscriptionKey);
  const label = sub ? `${sub.section} — ${sub.label}` : result.subscriptionKey;

  return htmlResponse(
    `<h1>Unsubscribed</h1><p>You've been unsubscribed from <strong style="color:#e4eaf2">${label}</strong>.<br><br>You can re-enable it any time from your <a href="/profile">Profile</a>.</p>`,
    200,
  );
}
