import NextAuthMiddleware from 'next-auth/middleware';

export default NextAuthMiddleware;

export const config = {
  // Protect all routes except auth pages and Next.js internals
  // Excludes auth pages, Next.js internals, static assets, and /.well-known/* (Chrome DevTools workspace detection)
  matcher: ['/((?!auth/|api/auth|_next/static|_next/image|favicon.ico|\\.well-known/).*)'],
};
