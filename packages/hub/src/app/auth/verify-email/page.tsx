'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [message, setMessage] = useState<string>('Verifying your email…');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided.');
      return;
    }

    async function verify() {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (res.ok) {
          setStatus('success');
          setMessage('Your email has been verified. You can now sign in.');
        } else {
          setStatus('error');
          setMessage(data.error ?? 'Verification failed. The link may have expired.');
        }
      } catch {
        setStatus('error');
        setMessage('An unexpected error occurred. Please try again.');
      }
    }

    void verify();
  }, [token]);

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-zinc-950 overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[500px] w-[500px] rounded-full bg-indigo-600/20 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl shadow-black/50 text-center">
        <h1 className="mb-4 text-2xl font-bold">Email verification</h1>

        {status === 'pending' && <p className="text-zinc-400 text-sm">{message}</p>}

        {status === 'success' && (
          <>
            <p className="mb-6 text-green-400 text-sm">{message}</p>
            <Link
              href="/auth/signin"
              className="inline-block rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition"
            >
              Sign in
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <p className="mb-6 text-red-400 text-sm">{message}</p>
            <Link href="/auth/signin" className="inline-block text-sm text-indigo-400 hover:underline">
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
