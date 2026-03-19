import NextAuth, { type AuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { cookies } from 'next/headers';
import {
  verifyUserPassword,
  findOrCreateUser,
  findUserByEmail,
  claimInviteToken,
  bindInviteTokenToUser,
} from '@my-hub/shared/services';
import { INVITE_COOKIE_NAME } from '../../../../lib/auth-constants';

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

      // Google OAuth: check email whitelist or a pending invite token cookie.
      const email = user.email?.trim().toLowerCase();
      if (!email) return false;

      const emailAllowed = ALLOWED_EMAILS.length > 0 && ALLOWED_EMAILS.includes(email);

      if (!emailAllowed) {
        // Check for a pending invite token stored by /api/auth/store-invite
        const cookieStore = await cookies();
        const inviteToken = cookieStore.get(INVITE_COOKIE_NAME)?.value;
        if (!inviteToken) return false;

        // Atomically claim the token
        const claimed = await claimInviteToken(inviteToken);
        if (!claimed) return false;

        // Provision the user (auto-verifies email since OAuth = trusted source)
        const dbUser = await findOrCreateUser(email, user.name ?? undefined);

        // Bind the token to the newly created user and clear the cookie
        await bindInviteTokenToUser(inviteToken, dbUser.id);
        cookieStore.delete(INVITE_COOKIE_NAME);

        return true;
      }

      // Email is in the whitelist — provision user if needed.
      await findOrCreateUser(email, user.name ?? undefined);
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token['userId'] = user.id;
      }
      // On initial sign-in, attach emailVerified from DB
      if (account && user?.email) {
        const dbUser = await findUserByEmail(user.email);
        if (dbUser) {
          token['emailVerified'] = dbUser.emailVerified?.toISOString() ?? null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token['userId']) {
        session.user.id = token['userId'] as string;
      }
      session.user.emailVerified = (token['emailVerified'] as string | null | undefined) ?? null;
      return session;
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
