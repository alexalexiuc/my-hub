'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';

export default function EmailVerificationBanner() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [resent, setResent] = useState(false);
  const [sending, setSending] = useState(false);

  // Don't show on auth pages
  const isAuthPage = pathname?.startsWith('/auth');
  if (isAuthPage || status !== 'authenticated') return null;

  // Hide if email is already verified
  if (session?.user?.emailVerified) return null;

  async function handleResend() {
    setSending(true);
    try {
      await fetch('/api/auth/send-verification', { method: 'POST' });
      setResent(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="w-full bg-yellow-950/60 border-b border-yellow-800/50 px-4 py-2 flex items-center justify-center gap-3 text-sm text-yellow-300">
      <span>Please verify your email address.</span>
      {resent ? (
        <span className="text-yellow-400 font-medium">Verification email sent!</span>
      ) : (
        <button
          onClick={handleResend}
          disabled={sending}
          className="underline hover:no-underline disabled:opacity-50 font-medium"
        >
          {sending ? 'Sending…' : 'Resend email'}
        </button>
      )}
    </div>
  );
}
