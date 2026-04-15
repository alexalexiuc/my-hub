import 'server-only';
import { getEnvVar } from '@my-hub/shared/utils';

function parseEmails(raw: string): string[] {
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
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
 */
const NEXTAUTH_URL = getEnvVar('NEXTAUTH_URL');

export const hubEnvConfig = {
  NEXTAUTH_SECRET: getEnvVar('NEXTAUTH_SECRET'),
  NEXTAUTH_URL,
  /** Parsed list of lowercase email addresses allowed to sign in via Google OAuth. */
  ALLOWED_EMAILS: parseEmails(getEnvVar('ALLOWED_EMAILS', '')),
  GOOGLE_CLIENT_ID: getEnvVar('GOOGLE_CLIENT_ID'),
  GOOGLE_CLIENT_SECRET: getEnvVar('GOOGLE_CLIENT_SECRET'),
  /** MCP server origin, used to validate redirect targets in the OAuth bridge. */
  MCP_SERVER_URL: getEnvVar('NEXT_PUBLIC_MCP_URL'),
  /** Public Hub URL, used for building report links and unsubscribe URLs. */
  HUB_URL: getEnvVar('HUB_URL'),
  /**
   * Shared cookie domain derived from NEXTAUTH_URL so that the session JWT
   * set by hub.alexiuc.dev is readable by sibling subdomains (e.g. mcp.alexiuc.dev).
   */
  SHARED_COOKIE_DOMAIN: getSharedCookieDomain(NEXTAUTH_URL),
} as const;
