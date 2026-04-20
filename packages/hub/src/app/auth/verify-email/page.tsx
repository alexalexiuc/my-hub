'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/utils';

type Status = 'verifying' | 'success' | 'error' | 'missing';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'missing');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) return;

    apiFetch('/api/auth/verify-email', { method: 'POST', body: { token }, silentToast: true })
      .then(() => setStatus('success'))
      .catch(e => {
        setErrorMsg(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
        setStatus('error');
      });
  }, [token]);

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-zinc-950 overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[500px] w-[500px] rounded-full bg-indigo-600/20 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl shadow-black/50 text-center space-y-4">
        {status === 'verifying' && (
          <>
            <h1 className="text-2xl font-bold">Verifying…</h1>
            <p className="text-sm text-zinc-400">Please wait while we verify your email address.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <h1 className="text-2xl font-bold">Email verified!</h1>
            <p className="text-sm text-zinc-400">Your email address has been verified. You can now sign in.</p>
            <Link href="/auth/signin" className="text-sm text-indigo-400 hover:underline">
              Sign in
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="text-2xl font-bold">Verification failed</h1>
            <p className="text-sm text-red-400">{errorMsg}</p>
            <p className="text-sm text-zinc-400">
              The link may have expired.{' '}
              <Link href="/auth/signin" className="text-indigo-400 hover:underline">
                Sign in
              </Link>{' '}
              to request a new one.
            </p>
          </>
        )}

        {status === 'missing' && (
          <>
            <h1 className="text-2xl font-bold">Invalid link</h1>
            <p className="text-sm text-zinc-400">This verification link is missing or malformed.</p>
            <Link href="/auth/signin" className="text-sm text-indigo-400 hover:underline">
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-zinc-400">Loading…</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
