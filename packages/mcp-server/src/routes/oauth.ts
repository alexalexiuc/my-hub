import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createHmac } from 'node:crypto';
import { envConfig } from '../config/env.js';
import {
  findOAuthClient,
  createOAuthClient,
  bindOAuthClientToUser,
  verifyClientSecret,
  ensureAllMcpServers,
  findUserByEmail,
  findUserById,
  createRefreshToken,
  findRefreshToken,
  deleteRefreshToken,
} from '@my-hub/shared/services';
import { signToken, verifyToken, verifyPkceS256, type AuthCodePayload } from '@my-hub/shared/auth';

const EMAIL_WHITELIST = (process.env['ALLOWED_EMAILS'] ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const NEXTAUTH_SECRET = process.env['NEXTAUTH_SECRET'] ?? '';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateRedirectUri(redirectUri: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch {
    return null;
  }

  // TODO: Re-enable redirect URI allowlist/HTTPS validation once the OAuth
  //       flow with Claude.ai is fully debugged.
  // const allowlist = envConfig.ALLOWED_REDIRECT_URIS;
  // if (allowlist.length > 0) {
  //   const allowed = allowlist.some((entry) => redirectUri === entry || redirectUri.startsWith(entry));
  //   return allowed ? parsed : null;
  // }
  //
  // if (parsed.protocol === 'https:') return parsed;
  // if (
  //   parsed.protocol === 'http:' &&
  //   (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]')
  // ) {
  //   return parsed;
  // }
  // return null;

  return parsed;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderConsentPage(params: URLSearchParams, email: string): string {
  const clientId = escapeHtml(params.get('client_id') ?? '');
  const clientName = escapeHtml(params.get('client_name') ?? clientId);
  const hiddenFields = [...params.entries()]
    .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`)
    .join('\n    ');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Authorize — Hub MCP Server</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 80px auto; padding: 0 16px; }
    h1 { font-size: 1.4rem; }
    .user { background: #f3f4f6; border-radius: 6px; padding: 8px 12px; margin: 16px 0; font-size: 0.9rem; }
    .actions { display: flex; gap: 12px; margin-top: 24px; }
    button { padding: 10px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 1rem; }
    button[value="allow"] { background: #2563eb; color: #fff; }
    button[value="deny"]  { background: #e5e7eb; color: #111; }
  </style>
</head>
<body>
  <h1>Authorize Hub MCP Server</h1>
  <p>The application <strong>${clientName}</strong> is requesting access to your hub data.</p>
  <div class="user">Signed in as <strong>${escapeHtml(email)}</strong></div>
  <form method="POST" action="/api/authorize">
    ${hiddenFields}
    <div class="actions">
      <button type="submit" name="action" value="allow">Allow</button>
      <button type="submit" name="action" value="deny">Deny</button>
    </div>
  </form>
</body>
</html>`;
}

function tokenError(error: string): { status: number; body: string } {
  return {
    status: 400,
    body: JSON.stringify({ error }),
  };
}

/**
 * Cookie name for the cross-subdomain session bridge.
 * Set by the hub's /api/auth/mcp-bridge endpoint — a simple HMAC-signed
 * token (email|expiry|signature) that avoids the jose/JWE version-mismatch
 * issues with reading the NextAuth session cookie directly.
 */
const BRIDGE_COOKIE_NAME = '__Hub-mcp-bridge';

/** Verify the bridge cookie and return the email, or null if invalid/missing. */
function getSessionEmail(req: FastifyRequest): string | null {
  if (!NEXTAUTH_SECRET) return null;

  const rawCookieHeader = req.headers.cookie ?? '';
  const match = rawCookieHeader.match(new RegExp(`(?:^|;\\s*)${BRIDGE_COOKIE_NAME}=([^;]*)`));
  if (!match?.[1]) return null;

  const token = decodeURIComponent(match[1]);
  const parts = token.split('|');
  if (parts.length !== 3) return null;

  const [email, expiryStr, sig] = parts;
  const expiry = Number(expiryStr);
  if (!email || !Number.isFinite(expiry)) return null;

  // Check expiry
  if (Date.now() > expiry) {
    req.log.info('[oauth] Bridge cookie expired');
    return null;
  }

  // Verify HMAC signature
  const payload = `${email}|${expiryStr}`;
  const expectedSig = createHmac('sha256', NEXTAUTH_SECRET).update(payload).digest('base64url');
  if (sig !== expectedSig) {
    req.log.warn('[oauth] Bridge cookie signature mismatch');
    return null;
  }

  req.log.info(`[oauth] Bridge cookie valid for email=${email}`);
  return email;
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function oauthRoutes(app: FastifyInstance) {
  // RFC 7591 — Dynamic Client Registration
  app.post('/register', async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const clientName = typeof body['client_name'] === 'string' ? body['client_name'] : null;
    const redirectUris: string[] = Array.isArray(body['redirect_uris'])
      ? (body['redirect_uris'] as string[]).filter((u) => typeof u === 'string' && validateRedirectUri(u) !== null)
      : [];

    // hub_<8 hex chars> — short prefix makes it identifiable at a glance
    const clientId = `hub_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
    const clientSecret = crypto.randomUUID();
    // 3 UUIDs concatenated → 288 bits of entropy, clearly distinct from the 128-bit clientSecret
    const tokenSigningSecret = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()]
      .join('')
      .replace(/-/g, '');

    await createOAuthClient({
      clientId,
      clientSecret,
      tokenSigningSecret,
      clientName,
      redirectUris,
    });

    return reply.status(201).send({
      client_id: clientId,
      client_secret: clientSecret,
      client_name: clientName,
      redirect_uris: redirectUris,
    });
  });

  // GET /authorize — show consent page
  app.get('/authorize', async (req, reply) => {
    const params = new URLSearchParams(req.query as Record<string, string>);

    const clientId = params.get('client_id');
    if (!clientId) {
      return reply.status(400).send('Missing client_id');
    }
    if (params.get('response_type') !== 'code') {
      return reply.status(400).send('Only response_type=code is supported');
    }
    const rawRedirectUri = params.get('redirect_uri');
    if (!rawRedirectUri || !validateRedirectUri(rawRedirectUri)) {
      return reply.status(400).send('Invalid or missing redirect_uri');
    }
    const codeChallenge = params.get('code_challenge');
    if (!codeChallenge) {
      return reply.status(400).send('Missing code_challenge (PKCE required)');
    }
    if (params.get('code_challenge_method') !== 'S256') {
      return reply.status(400).send('Only code_challenge_method=S256 is supported');
    }

    const client = await findOAuthClient(clientId);
    if (!client) {
      return reply.status(400).send('Unknown client_id');
    }

    const email = getSessionEmail(req);
    if (!email) {
      // Redirect through the hub's bridge endpoint which verifies the NextAuth
      // session and sets a simple HMAC cookie readable by this MCP server.
      const fullUrl = `${req.protocol}://${req.hostname}${req.url}`;
      const bridgeUrl = `${envConfig.HUB_URL}/api/auth/mcp-bridge?redirect=${encodeURIComponent(fullUrl)}`;
      return reply.redirect(bridgeUrl);
    }

    if (EMAIL_WHITELIST.length > 0 && !EMAIL_WHITELIST.includes(email.toLowerCase())) {
      return reply.status(403).send('Email not authorized');
    }

    // Add client_name to params for the consent page
    if (client.clientName) params.set('client_name', client.clientName);

    return reply.header('Content-Type', 'text/html; charset=utf-8').send(renderConsentPage(params, email));
  });

  // POST /authorize — process consent
  app.post('/authorize', async (req, reply) => {
    const body = req.body as Record<string, string>;
    const redirectUri = body['redirect_uri'] ?? '';
    const state = body['state'] ?? null;

    const parsedRedirectUri = validateRedirectUri(redirectUri);
    if (!parsedRedirectUri) {
      return reply.status(400).send('Invalid redirect_uri');
    }

    const sendError = (error: string) => {
      parsedRedirectUri.searchParams.set('error', error);
      if (state) parsedRedirectUri.searchParams.set('state', state);
      return reply.redirect(parsedRedirectUri.toString());
    };

    if (body['action'] !== 'allow') {
      return sendError('access_denied');
    }

    const clientId = body['client_id'];
    if (!clientId) return reply.status(400).send('Missing client_id');

    const client = await findOAuthClient(clientId);
    if (!client) return sendError('invalid_client');

    const email = getSessionEmail(req);
    if (!email) return sendError('login_required');

    if (EMAIL_WHITELIST.length > 0 && !EMAIL_WHITELIST.includes(email.toLowerCase())) {
      return sendError('access_denied');
    }

    // Bind client + provision MCP server rows
    const user = await findUserByEmail(email);
    if (!user) return sendError('login_required');
    await bindOAuthClientToUser(clientId, user.id);
    await ensureAllMcpServers(user.id);
    const userId = user.id;

    const codeChallenge = body['code_challenge'] ?? '';
    const codeChallengeMethod = body['code_challenge_method'] ?? 'S256';

    // TODO: Make auth token single-use(either inMemory map or db table) to prevent replay attacks. Currently the 5 minute expiry is the only protection.
    const authCode = await signToken(
      {
        client_id: clientId,
        user_id: userId,
        redirect_uri: redirectUri,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
        exp: Date.now() + 5 * 60 * 1000, // 5 minutes
      } satisfies AuthCodePayload,
      client.tokenSigningSecret,
    );

    parsedRedirectUri.searchParams.set('code', authCode);
    if (state) parsedRedirectUri.searchParams.set('state', state);
    return reply.redirect(parsedRedirectUri.toString());
  });

  // POST /token — exchange auth code for access token
  app.post('/token', async (req, reply) => {
    const body = req.body as Record<string, string>;

    const sendTokenError = (error: string, status = 400) => {
      return reply.status(status).header('Content-Type', 'application/json').send(JSON.stringify({ error }));
    };

    // client_credentials grant — for machine-to-machine use (e.g. e2e tests)
    if (body['grant_type'] === 'client_credentials') {
      const clientId = body['client_id'];
      const clientSecret = body['client_secret'];
      if (!clientId || !clientSecret) return sendTokenError('invalid_client', 401);

      const [client, secretOk] = await Promise.all([
        findOAuthClient(clientId),
        verifyClientSecret(clientId, clientSecret),
      ]);
      if (!client || !secretOk) return sendTokenError('invalid_client', 401);
      if (!client.userId) return sendTokenError('invalid_client', 401);

      const tokenUser = await findUserById(client.userId);
      const [accessToken, refreshToken] = await Promise.all([
        signToken(
          { client_id: clientId, user_id: client.userId, email: tokenUser?.email, exp: Date.now() + 86_400_000 },
          client.tokenSigningSecret,
        ),
        createRefreshToken(clientId, client.userId),
      ]);
      return reply.header('Content-Type', 'application/json').send(
        JSON.stringify({
          access_token: accessToken,
          token_type: 'bearer',
          expires_in: 86400,
          refresh_token: refreshToken,
        }),
      );
    }

    // refresh_token grant — issue a new access token using a valid refresh token
    if (body['grant_type'] === 'refresh_token') {
      const clientId = body['client_id'];
      const clientSecret = body['client_secret'];
      const plainRefreshToken = body['refresh_token'];
      if (!clientId || !clientSecret || !plainRefreshToken) {
        return sendTokenError('invalid_request');
      }

      const [client, secretOk] = await Promise.all([
        findOAuthClient(clientId),
        verifyClientSecret(clientId, clientSecret),
      ]);
      if (!client || !secretOk) return sendTokenError('invalid_client', 401);

      const tokenRow = await findRefreshToken(clientId, plainRefreshToken);
      if (!tokenRow) return sendTokenError('invalid_grant');

      // Rotate: issue the new refresh token first, then delete the old one.
      // This ordering means that if the response fails mid-flight the old token
      // is still present and the client can retry — a deliberate tradeoff that
      // prioritises availability over strict single-use enforcement, which is
      // acceptable given the 30-day expiry and per-client scoping.
      const [tokenUser, newRefreshToken] = await Promise.all([
        findUserById(tokenRow.userId),
        createRefreshToken(clientId, tokenRow.userId),
      ]);
      await deleteRefreshToken(tokenRow.id);

      const accessToken = await signToken(
        {
          client_id: clientId,
          user_id: tokenRow.userId,
          email: tokenUser?.email,
          exp: Date.now() + 86_400_000, // 1 day
        },
        client.tokenSigningSecret,
      );

      return reply.header('Content-Type', 'application/json').send(
        JSON.stringify({
          access_token: accessToken,
          token_type: 'bearer',
          expires_in: 86400,
          refresh_token: newRefreshToken,
        }),
      );
    }

    if (body['grant_type'] !== 'authorization_code') {
      const { status, body: b } = tokenError('unsupported_grant_type');
      return reply.status(status).header('Content-Type', 'application/json').send(b);
    }

    const clientId = body['client_id'];
    const clientSecret = body['client_secret'];
    if (!clientId || !clientSecret) {
      return sendTokenError('invalid_client', 401);
    }

    const [client, secretOk] = await Promise.all([
      findOAuthClient(clientId),
      verifyClientSecret(clientId, clientSecret),
    ]);
    if (!client || !secretOk) {
      return sendTokenError('invalid_client', 401);
    }

    const code = body['code'];
    if (!code) return sendTokenError('invalid_request');

    const authCodePayload = await verifyToken<AuthCodePayload>(code, client.tokenSigningSecret);
    if (!authCodePayload) return sendTokenError('invalid_grant');

    const redirectUri = body['redirect_uri'] ?? '';
    if (authCodePayload.client_id !== clientId || authCodePayload.redirect_uri !== redirectUri) {
      return sendTokenError('invalid_grant');
    }

    const codeVerifier = body['code_verifier'];
    if (!codeVerifier) return sendTokenError('invalid_grant');

    const pkceOk = await verifyPkceS256(codeVerifier, authCodePayload.code_challenge);
    if (!pkceOk) return sendTokenError('invalid_grant');

    const tokenUser = await findUserById(authCodePayload.user_id);
    const [accessToken, refreshToken] = await Promise.all([
      signToken(
        {
          client_id: clientId,
          user_id: authCodePayload.user_id,
          email: tokenUser?.email,
          exp: Date.now() + 86_400_000, // 1 day
        },
        client.tokenSigningSecret,
      ),
      createRefreshToken(clientId, authCodePayload.user_id),
    ]);

    return reply.header('Content-Type', 'application/json').send(
      JSON.stringify({
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 86400,
        refresh_token: refreshToken,
      }),
    );
  });
}
