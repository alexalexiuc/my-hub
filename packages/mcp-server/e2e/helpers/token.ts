import { signToken } from '@my-hub/shared/auth';
import { getE2eEnv } from './env.js';

/**
 * Generates a fresh access token signed with the test client's tokenSigningSecret.
 * The token is valid for 1 hour from the time of generation.
 *
 * This mirrors the token produced by POST /token in the OAuth flow, and is
 * accepted by hubTokenVerifier as long as the OAuth client exists in the DB.
 */
export async function generateToken(): Promise<string> {
  const { clientId, tokenSigningSecret, userId } = getE2eEnv();
  const payload = {
    client_id: clientId,
    user_id: userId,
    exp: Date.now() + 60 * 60 * 1_000, // 1 hour
  };
  return signToken(payload, tokenSigningSecret);
}
