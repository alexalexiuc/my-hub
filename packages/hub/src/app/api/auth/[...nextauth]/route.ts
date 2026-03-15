import NextAuth, { type AuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env['GOOGLE_CLIENT_ID'] ?? '',
      clientSecret: process.env['GOOGLE_CLIENT_SECRET'] ?? '',
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Allow only the configured email(s)
      const allowedEmails = (process.env['ALLOWED_EMAILS'] ?? '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

      if (allowedEmails.length === 0) return false;
      const email = user.email?.trim().toLowerCase();
      if (!email) return false;

      return allowedEmails.includes(email);
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
