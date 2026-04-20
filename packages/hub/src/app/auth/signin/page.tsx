'use client';

import { Suspense, useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { GoogleIcon } from '@/components/icons';
import { Input } from '@/components';

export default function SignInPage() {
  return (
    <Suspense
      fallback={<div className="flex min-h-screen items-center justify-center text-zinc-400">Loading sign-in...</div>}
    >
      <SignInContent />
    </Suspense>
  );
}

function SignInContent() {
  const searchParams = useSearchParams();
  const { status } = useSession();
  const rawCallbackUrl = searchParams.get('callbackUrl');
  const callbackUrl = normalizeCallbackUrl(rawCallbackUrl);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect away from sign-in page only when arriving via a protected route
  // (i.e. there is an explicit callbackUrl). Without one the user likely landed
  // here after sign-out, so we keep them on the page instead of bouncing back.
  useEffect(() => {
    if (status === 'authenticated' && rawCallbackUrl) {
      window.location.href = callbackUrl;
    }
  }, [status, callbackUrl, rawCallbackUrl]);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await signIn('credentials', {
        email,
        password,
        callbackUrl,
        redirect: false,
      });
      if (result?.error) {
        setError('Invalid email or password.');
      } else if (result?.url) {
        window.location.href = result.url;
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-zinc-950 overflow-hidden">
      {/* Decorative glow */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[500px] w-[500px] rounded-full bg-indigo-600/20 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl shadow-black/50">
        <h1 className="mb-6 text-2xl font-bold text-center">Sign in to My HUB</h1>

        {/* Email + password form */}
        <form onSubmit={handleCredentials} className="space-y-3">
          <div>
            <label htmlFor="email" className="text-xs text-zinc-400 block mb-1">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="password" className="text-xs text-zinc-400">
                Password
              </label>
              <Link href="/auth/forgot-password" className="text-xs text-indigo-400 hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* Divider */}
        <div className="my-5 flex items-center gap-3">
          <div className="flex-1 h-px bg-zinc-700" />
          <span className="text-xs text-zinc-500">or</span>
          <div className="flex-1 h-px bg-zinc-700" />
        </div>

        {/* Google */}
        <button
          onClick={() => signIn('google', { callbackUrl })}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700 transition flex items-center justify-center gap-2"
        >
          <GoogleIcon />
          Sign in with Google
        </button>

        {/* Register link */}
        <p className="mt-6 text-center text-sm text-zinc-400">
          No account?{' '}
          <Link href="/auth/register" className="text-indigo-400 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}

function normalizeCallbackUrl(rawCallbackUrl: string | null) {
  if (!rawCallbackUrl) return '/';

  try {
    const { origin } = window.location;
    const parsed = new URL(rawCallbackUrl, origin);

    if (parsed.origin === origin) {
      if (parsed.pathname.startsWith('/.well-known')) return '/';
      const normalizedPath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      return normalizedPath || '/';
    }

    // TODO: Re-enable MCP server origin check once NEXT_PUBLIC_MCP_URL is
    //       confirmed to be set at build time. For now, allow any HTTPS
    //       cross-origin callback so the OAuth flow can be debugged.
    if (parsed.protocol === 'https:') {
      return rawCallbackUrl;
    }

    return '/';
  } catch {
    return '/';
  }
}
