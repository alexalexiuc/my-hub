import NextAuthMiddleware from 'next-auth/middleware';
import type { NextRequest } from 'next/server';

export default function proxy(req: NextRequest) {
  return NextAuthMiddleware(req);
}

export const config = {
  // Protect all routes except auth pages and Next.js internals
  matcher: ['/((?!auth/|api/auth|_next/static|_next/image|favicon.ico).*)'],
};
