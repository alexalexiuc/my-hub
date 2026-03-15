import NextAuthMiddleware from 'next-auth/middleware';

export default NextAuthMiddleware;

export const config = {
  // Protect all routes except auth pages and Next.js internals
  matcher: ['/((?!auth/|api/auth|_next/static|_next/image|favicon.ico).*)'],
};
