import NextAuth, { type AuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";

export const authOptions: AuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env["GITHUB_CLIENT_ID"] ?? "",
      clientSecret: process.env["GITHUB_CLIENT_SECRET"] ?? "",
    }),
  ],
  callbacks: {
    async signIn(params) {
      // Allow only the configured GitHub username(s)
      const allowedUsers = (process.env["ALLOWED_GITHUB_USERS"] ?? "")
        .split(",")
        .map((u) => u.trim());
      const githubProfile = params.profile as { login?: string } | undefined;
      return allowedUsers.includes(githubProfile?.login ?? "");
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
