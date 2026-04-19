import { signToken, verifyToken } from '../../auth';
import { sharedEnvConfig } from '../../config/env';
import { UNSUBSCRIBE_TOKEN_EXPIRY_MINUTES } from '../../constants';

export async function generateUnsubscribeToken(userId: string, subscriptionKey: string): Promise<string> {
  return signToken(
    { sub: userId, subscriptionKey },
    sharedEnvConfig.UNSUBSCRIBE_SECRET,
    UNSUBSCRIBE_TOKEN_EXPIRY_MINUTES,
  );
}

export async function verifyUnsubscribeToken(
  token: string,
): Promise<{ userId: string; subscriptionKey: string } | null> {
  const payload = await verifyToken<{ sub: string; subscriptionKey: string }>(
    token,
    sharedEnvConfig.UNSUBSCRIBE_SECRET,
  );
  if (!payload?.sub || typeof payload.subscriptionKey !== 'string') return null;
  return { userId: payload.sub, subscriptionKey: payload.subscriptionKey };
}
