import NextAuth, { type AuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { verifyUserPassword, findOrCreateUser, findUserByEmail, backfillUserGoogleId } from '@my-hub/shared/services';
import { hubEnvConfig } from '@/config/env';

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: hubEnvConfig.GOOGLE_CLIENT_ID,
      clientSecret: hubEnvConfig.GOOGLE_CLIENT_SECRET,
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
      const email = user.email?.trim().toLowerCase();
      if (!email) return false;

      // Single DB lookup to check if the user already exists (registered via credentials/invite).
      // If they do, link their Google account without re-querying via findOrCreateUser.
      const existingUser = await findUserByEmail(email);
      if (existingUser) {
        // Backfill googleId if not yet set (single UPDATE, no-op if already set).
        if (user.id) await backfillUserGoogleId(existingUser.id, user.id);
        return true;
      }

      // New Google sign-in (no existing account): apply the email whitelist.
      if (!hubEnvConfig.ALLOWED_EMAILS.includes(email)) return false;

      // Create user in database for first-time whitelisted Google OAuth login.
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
          // Allow cross-origin redirects only to the configured MCP server URL.
          try {
            const mcpOrigin = new URL(hubEnvConfig.MCP_SERVER_URL).origin;
            if (targetUrl.origin === mcpOrigin) return url;
          } catch {
            // MCP_SERVER_URL not configured or invalid – deny cross-origin redirect.
          }
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
  ...(hubEnvConfig.SHARED_COOKIE_DOMAIN
    ? {
        cookies: {
          sessionToken: {
            name: `__Secure-next-auth.session-token`,
            options: {
              httpOnly: true,
              sameSite: 'lax' as const,
              path: '/',
              secure: true,
              domain: hubEnvConfig.SHARED_COOKIE_DOMAIN,
            },
          },
        },
      }
    : {}),
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
