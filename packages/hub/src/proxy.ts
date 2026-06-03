import { getToken } from 'next-auth/jwt';
import { type NextRequest, NextResponse } from 'next/server';
import { hubEnvConfig } from '@/config/env';

/**
 * Combined proxy: per-request CSP nonce + NextAuth route protection.
 *
 * Next.js reads the nonce from the CSP header and injects it into its own
 * inline <script> bootstrap tags. The `x-nonce` request header passes the same
 * value to server components that need it.
 *
 * `style-src 'unsafe-inline'` is required because several libraries (Sonner,
 * Radix UI portals, etc.) apply inline styles at runtime.
 *
 * `strict-dynamic` lets the nonce'd bootstrap script load page chunks
 * dynamically without extra entries in the allowlist.
 */
// MapLibre GL tile origins (CARTO Dark Matter basemap + fonts)
const MAP_ORIGINS = [
  'https://basemaps.cartocdn.com',
  'https://*.basemaps.cartocdn.com',
  'https://fonts.openmaptiles.org',
  'https://openmaptiles.github.io',
].join(' ');

function buildCsp(nonce: string): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self' ${MAP_ORIGINS}`,
    // MapLibre GL spawns WebWorkers from blob: URLs for tile decoding
    `worker-src blob:`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
  ].join('; ');
}

export default async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce);

  // Auth check — redirect unauthenticated requests to sign-in
  const { pathname } = request.nextUrl;
  const isPublic =
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/.well-known/');

  if (!isPublic) {
    const token = await getToken({ req: request, secret: hubEnvConfig.NEXTAUTH_SECRET });
    if (!token) {
      // Use NEXTAUTH_URL as the base so that Docker's internal bind address
      // (0.0.0.0:3000) never leaks into the callbackUrl sent to Google OAuth.
      const baseUrl = hubEnvConfig.NEXTAUTH_URL;
      const signIn = new URL('/auth/signin', baseUrl);
      const callbackPath = request.nextUrl.pathname + request.nextUrl.search;
      signIn.searchParams.set('callbackUrl', new URL(callbackPath, baseUrl).toString());
      return NextResponse.redirect(signIn);
    }
  }

  // Forward the nonce to server components via request header
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|\\.well-known/).*)'],
};
