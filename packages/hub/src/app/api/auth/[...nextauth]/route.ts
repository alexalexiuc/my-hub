import NextAuth, { type AuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { verifyUserPassword, findOrCreateUser } from '@my-hub/shared/services';

const ALLOWED_EMAILS = (process.env['ALLOWED_EMAILS'] ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// Derive shared cookie domain from NEXTAUTH_URL so the session JWT is
// readable by sibling subdomains (e.g. mcp.alexiuc.dev reads a cookie
// set by hub.alexiuc.dev).  Only kicks in when the hub runs on a
// subdomain with at least two labels before the TLD.
function getSharedCookieDomain(): string | undefined {
  try {
    const host = new URL(process.env['NEXTAUTH_URL'] ?? '').hostname;
    // localhost / 127.0.0.1 — no shared domain needed
    if (host === 'localhost' || host.startsWith('127.') || host === '[::1]') return undefined;
    const parts = host.split('.');
    // e.g. hub.alexiuc.dev → .alexiuc.dev
    if (parts.length >= 3) return '.' + parts.slice(-2).join('.');
    return undefined;
  } catch {
    return undefined;
  }
}

const SHARED_COOKIE_DOMAIN = getSharedCookieDomain();

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env['GOOGLE_CLIENT_ID'] ?? '',
      clientSecret: process.env['GOOGLE_CLIENT_SECRET'] ?? '',
    }),
    CredentialsProvider({
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await verifyUserPassword(credentials.email, credentials.password);
        if (!user) return null;
        return { id: user.id, email: user.email, name: user.name ?? null };
      },
    }),
  ],
  callbacks: {
    async signIn({ account, user }) {
      // Credentials users: already verified in authorize(); let them through.
      if (account?.provider === 'credentials') return true;

      // Google OAuth: apply the email whitelist and provision user in DB.
      if (ALLOWED_EMAILS.length === 0) return false;
      const email = user.email?.trim().toLowerCase();
      if (!email) return false;
      if (!ALLOWED_EMAILS.includes(email)) return false;

      // Create user in database if they don't exist yet (first-time Google OAuth login).
      // user.id from the Google provider is the Google account ID (sub claim).
      await findOrCreateUser(email, user.name ?? undefined, user.id);
      return true;
    },
    async redirect({ url, baseUrl }) {
      const fallbackUrl = new URL('/', baseUrl).toString();
      const baseOrigin = new URL(baseUrl).origin;

      try {
        const targetUrl = new URL(url, baseUrl);

        if (targetUrl.origin !== baseOrigin) {
          // TODO: Re-enable strict MCP_SERVER_URL origin check once
          //       NEXT_PUBLIC_MCP_URL env is confirmed set at build time.
          //       For now, allow any HTTPS cross-origin redirect so the
          //       OAuth flow can be debugged end-to-end.
          if (targetUrl.protocol === 'https:') return url;
          return fallbackUrl;
        }
        if (targetUrl.pathname.startsWith('/.well-known')) return fallbackUrl;

        return targetUrl.toString();
      } catch {
        return fallbackUrl;
      }
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
  session: {
    strategy: 'jwt',
  },
  // Share session cookie across subdomains so the MCP server (mcp.alexiuc.dev)
  // can read the JWT set by the hub (hub.alexiuc.dev).
  ...(SHARED_COOKIE_DOMAIN
    ? {
        cookies: {
          sessionToken: {
            name: `__Secure-next-auth.session-token`,
            options: {
              httpOnly: true,
              sameSite: 'lax' as const,
              path: '/',
              secure: true,
              domain: SHARED_COOKIE_DOMAIN,
            },
          },
        },
      }
    : {}),
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
