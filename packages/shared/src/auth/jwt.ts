import { createHash, randomUUID } from 'crypto';
import { SignJWT, decodeJwt, jwtVerify, type JWTPayload } from 'jose';
export type { JWTPayload };

export interface McpTokenPayload {
  client_id: string;
  user_id: string;
  email?: string;
}

export interface AuthCodePayload {
  client_id: string;
  user_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
}

const toKey = (secret: string) => new TextEncoder().encode(secret);

export async function signToken(
  payload: Omit<JWTPayload, 'exp'>,
  secret: string,
  expiresInMinutes = 5,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${expiresInMinutes}m`)
    .sign(toKey(secret));
}

export async function verifyToken<T>(token: string, secret: string): Promise<(T & JWTPayload) | null> {
  try {
    const { payload } = await jwtVerify(token, toKey(secret));
    return payload as T & JWTPayload;
  } catch {
    return null;
  }
}

export function decodeTokenPayload<T>(token: string): Partial<T> & JWTPayload {
  return decodeJwt(token) as Partial<T> & JWTPayload;
}

export function verifyPkceS256(codeVerifier: string, codeChallenge: string): boolean {
  const hash = createHash('sha256').update(codeVerifier).digest('base64url');
  return hash === codeChallenge;
}
