import { createHmac, timingSafeEqual } from 'crypto';
import { sharedEnvConfig } from '../../config/env';

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSecret(): string {
  const s = sharedEnvConfig.UNSUBSCRIBE_SECRET;
  if (!s) throw new Error('UNSUBSCRIBE_SECRET (or NEXTAUTH_SECRET as fallback) env var is not set');
  return s;
}

export function generateUnsubscribeToken(userId: string, subscriptionKey: string): string {
  const expiry = Date.now() + TOKEN_TTL_MS;
  const payload = `${userId}|${subscriptionKey}|${expiry}`;
  const sig = createHmac('sha256', getSecret()).update(payload).digest('base64url');
  return Buffer.from(`${payload}|${sig}`).toString('base64url');
}

export function verifyUnsubscribeToken(token: string): { userId: string; subscriptionKey: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split('|');
    if (parts.length !== 4) return null;
    const [userId, subscriptionKey, expiryStr, sig] = parts;
    const expiry = Number(expiryStr);
    if (!Number.isFinite(expiry)) return null;
    if (Date.now() > expiry) return null;
    const payload = `${userId}|${subscriptionKey}|${expiryStr}`;
    const expected = createHmac('sha256', getSecret()).update(payload).digest('base64url');
    const sigBuf = Buffer.from(sig!, 'base64url');
    const expBuf = Buffer.from(expected, 'base64url');
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
    return { userId: userId!, subscriptionKey: subscriptionKey! };
  } catch {
    return null;
  }
}
