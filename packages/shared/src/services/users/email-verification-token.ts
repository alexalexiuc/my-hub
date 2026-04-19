import { signToken, verifyToken } from '../../auth';
import { sharedEnvConfig } from '../../config/env';
import { EMAIL_VERIFICATION_TOKEN_EXPIRY_MINUTES } from '../../constants/auth';

export async function generateEmailVerificationToken(userId: string): Promise<string> {
  return signToken({ sub: userId }, sharedEnvConfig.EMAIL_VERIFICATION_SECRET, EMAIL_VERIFICATION_TOKEN_EXPIRY_MINUTES);
}

export async function verifyEmailVerificationToken(token: string): Promise<{ userId: string } | null> {
  const payload = await verifyToken<{ sub: string }>(token, sharedEnvConfig.EMAIL_VERIFICATION_SECRET);
  if (!payload?.sub) return null;
  return { userId: payload.sub };
}
