import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getToken } from 'next-auth/jwt';
import {
  findOAuthClient,
  createOAuthClient,
  bindOAuthClientToUser,
  ensureAllMcpServers,
  findUserByEmail,
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
  if (parsed.protocol === 'https:') return parsed;
  if (
    parsed.protocol === 'http:' &&
    (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]')
  ) {
    return parsed;
  }
  return null;
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
  <form method="POST" action="/authorize">
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

async function getSessionEmail(req: FastifyRequest): Promise<string | null> {
  if (!NEXTAUTH_SECRET) return null;
  try {
    // next-auth/jwt getToken reads the session cookie from the request
    // We need to adapt the Fastify request to the shape getToken expects
    const adaptedReq = {
      headers: req.headers as Record<string, string | string[] | undefined>,
      cookies: (req as unknown as { cookies?: Record<string, string> }).cookies ?? {},
      method: req.method,
      url: req.url,
      body: req.body,
    };
    const token = await getToken({
      req: adaptedReq as Parameters<typeof getToken>[0]['req'],
      secret: NEXTAUTH_SECRET,
    });
    if (!token?.email) return null;
    return String(token.email);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function oauthRoutes(app: FastifyInstance) {
  // RFC 8414 — Server Metadata
  app.get('/.well-known/oauth-authorization-server', async (req, reply) => {
    const base = `${req.protocol}://${req.hostname}`;
    return reply.send({
      issuer: base,
      authorization_endpoint: `${base}/authorize`,
      token_endpoint: `${base}/token`,
      registration_endpoint: `${base}/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['client_secret_post'],
    });
  });

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

    const email = await getSessionEmail(req);
    if (!email) {
      const loginUrl = `/auth/signin?callbackUrl=${encodeURIComponent(req.url)}`;
      return reply.redirect(loginUrl);
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

    const email = await getSessionEmail(req);
    if (!email) return sendError('login_required');

    if (EMAIL_WHITELIST.length > 0 && !EMAIL_WHITELIST.includes(email.toLowerCase())) {
      return sendError('access_denied');
    }

    // Upsert user + bind client + provision MCP server rows
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

    if (body['grant_type'] !== 'authorization_code') {
      const { status, body: b } = tokenError('unsupported_grant_type');
      return reply.status(status).header('Content-Type', 'application/json').send(b);
    }

    const sendTokenError = (error: string, status = 400) => {
      return reply.status(status).header('Content-Type', 'application/json').send(JSON.stringify({ error }));
    };

    const clientId = body['client_id'];
    const clientSecret = body['client_secret'];
    if (!clientId || !clientSecret) {
      return sendTokenError('invalid_client', 401);
    }

    const client = await findOAuthClient(clientId);
    if (!client || client.clientSecret !== clientSecret) {
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

    const accessToken = await signToken(
      {
        client_id: clientId,
        user_id: authCodePayload.user_id,
        exp: Date.now() + 86_400_000, // 1 day
      },
      client.tokenSigningSecret,
    );

    return reply.header('Content-Type', 'application/json').send(
      JSON.stringify({
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 86400,
      }),
    );
  });
}
