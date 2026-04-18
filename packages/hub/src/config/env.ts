import 'server-only';
import { getEnvVar } from '@my-hub/shared/utils';

function parseEmails(raw: string): string[] {
  return raw
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

function getSharedCookieDomain(nextAuthUrl: string): string | undefined {
  try {
    const host = new URL(nextAuthUrl).hostname;
    if (host === 'localhost' || host.startsWith('127.') || host === '[::1]') return undefined;
    const parts = host.split('.');
    if (parts.length >= 3) return '.' + parts.slice(-2).join('.');
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Hub server-side environment configuration.
 *
 * This file is marked `server-only` — any accidental import from a Client
 * Component will cause a build-time error, preventing secrets from leaking
 * to the browser bundle.
 *
 * Uses lazy property getters so that importing this module at Next.js build
 * time (when env vars are not yet set) does not throw. Values are read on
 * first access, which always happens at request/runtime.
 */
export const hubEnvConfig = {
  get NEXTAUTH_SECRET() {
    return getEnvVar('NEXTAUTH_SECRET');
  },
  get NEXTAUTH_URL() {
    return getEnvVar('NEXTAUTH_URL');
  },
  /** Parsed list of lowercase email addresses allowed to sign in via Google OAuth. */
  get ALLOWED_EMAILS() {
    return parseEmails(getEnvVar('ALLOWED_EMAILS', ''));
  },
  get GOOGLE_CLIENT_ID() {
    return getEnvVar('GOOGLE_CLIENT_ID');
  },
  get GOOGLE_CLIENT_SECRET() {
    return getEnvVar('GOOGLE_CLIENT_SECRET');
  },
  /** MCP server origin, used to validate redirect targets in the OAuth bridge. */
  get MCP_SERVER_URL() {
    return getEnvVar('NEXT_PUBLIC_MCP_URL');
  },
  /** Public Hub URL, used for building report links and unsubscribe URLs. */
  get HUB_URL() {
    return getEnvVar('HUB_URL');
  },
  /**
   * Shared cookie domain derived from NEXTAUTH_URL so that the session JWT
   * set by hub.alexiuc.dev is readable by sibling subdomains (e.g. mcp.alexiuc.dev).
   */
  get SHARED_COOKIE_DOMAIN() {
    return getSharedCookieDomain(getEnvVar('NEXTAUTH_URL'));
  },
  /** Current Node.js environment (e.g. 'development', 'test', 'production'). */
  get NODE_ENV() {
    return getEnvVar('NODE_ENV', 'development');
  },
};
