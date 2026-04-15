import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { createHmac } from 'node:crypto';
import { authOptions } from '../[...nextauth]/route';
import { withErrorLogging } from '@/lib/api/with-error-logging';
import { hubEnvConfig } from '@/config/env';

/**
 * Cookie name for the simple cross-subdomain session bridge.
 * This cookie is readable by the MCP server (unlike the NextAuth JWE cookie
 * which requires matching jose library versions to decrypt).
 */
const BRIDGE_COOKIE_NAME = '__Hub-mcp-bridge';
const BRIDGE_COOKIE_MAX_AGE = 5 * 60; // 5 minutes — just enough for the OAuth flow

/** Create an HMAC-signed bridge token: email|expiry|signature */
function createBridgeToken(email: string): string {
  const expiry = Date.now() + BRIDGE_COOKIE_MAX_AGE * 1000;
  const payload = `${email}|${expiry}`;
  const sig = createHmac('sha256', hubEnvConfig.NEXTAUTH_SECRET).update(payload).digest('base64url');
  return `${payload}|${sig}`;
}

/**
 * GET /api/auth/mcp-bridge?redirect=<url>
 *
 * Verifies the user's NextAuth session (cookie works because we're on the hub
 * domain), creates a simple HMAC-signed bridge cookie on the shared parent
 * domain, then redirects back to the MCP server's authorize endpoint.
 */
async function mcpBridgeHandler(req: NextRequest) {
  const redirect = req.nextUrl.searchParams.get('redirect');

  // Validate redirect target: must be the MCP server origin (or any HTTPS for now)
  if (!redirect) {
    return NextResponse.json({ error: 'Missing redirect parameter' }, { status: 400 });
  }

  let redirectUrl: URL;
  try {
    redirectUrl = new URL(redirect);
  } catch {
    return NextResponse.json({ error: 'Invalid redirect URL' }, { status: 400 });
  }

  // Safety: only redirect to the MCP server or HTTPS origins
  if (hubEnvConfig.MCP_SERVER_URL) {
    try {
      if (redirectUrl.origin !== new URL(hubEnvConfig.MCP_SERVER_URL).origin) {
        return NextResponse.json({ error: 'Redirect origin not allowed' }, { status: 403 });
      }
    } catch {
      // MCP_SERVER_URL not parseable — fall through to HTTPS check
    }
  }
  if (redirectUrl.protocol !== 'https:' && redirectUrl.hostname !== 'localhost') {
    return NextResponse.json({ error: 'Redirect must be HTTPS' }, { status: 403 });
  }

  // Check NextAuth session (works here because we're on hub.alexiuc.dev)
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    // Not logged in — redirect to signin, with callbackUrl back to this bridge
    const bridgeUrl = req.nextUrl.toString();
    const signinUrl = new URL('/auth/signin', req.nextUrl.origin);
    signinUrl.searchParams.set('callbackUrl', bridgeUrl);
    return NextResponse.redirect(signinUrl.toString());
  }

  // Create bridge token and set it as a cookie on the shared domain
  const token = createBridgeToken(session.user.email);
  const domain = hubEnvConfig.SHARED_COOKIE_DOMAIN;
  const isSecure = req.nextUrl.protocol === 'https:';

  const response = NextResponse.redirect(redirect);
  response.cookies.set(BRIDGE_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: BRIDGE_COOKIE_MAX_AGE,
    ...(domain ? { domain } : {}),
  });
  return response;
}

export const GET = withErrorLogging(mcpBridgeHandler);
