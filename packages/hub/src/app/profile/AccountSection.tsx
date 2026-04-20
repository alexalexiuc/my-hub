'use client';

import { useState } from 'react';
import { SectionCard } from '@/components/SectionCard';
import { apiFetch } from '@/lib/utils';
import type { UserProfile } from './types';

type AccountSectionProps = {
  user: UserProfile;
};

export function AccountSection({ user }: AccountSectionProps) {
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  async function resendVerification() {
    setResending(true);
    setResendSuccess(false);
    setResendError(null);
    try {
      await apiFetch('/api/user/resend-verification', { method: 'POST', silentToast: true });
      setResendSuccess(true);
    } catch {
      setResendError('Failed to send verification email. Please try again later.');
    } finally {
      setResending(false);
    }
  }

  return (
    <SectionCard title="Account">
      <div className="space-y-3 text-sm">
        <div className="flex items-start justify-between">
          <span className="text-zinc-400">Email</span>
          <div className="space-y-1 text-right">
            <div className="flex items-center justify-end gap-2">
              <span className="font-medium">{user.email}</span>
              {user.emailVerified ? (
                <span className="rounded border border-emerald-800/50 bg-emerald-900/40 px-1.5 py-0.5 text-xs text-emerald-400">
                  Verified
                </span>
              ) : (
                <span className="rounded border border-yellow-800/50 bg-yellow-900/40 px-1.5 py-0.5 text-xs text-yellow-400">
                  Unverified
                </span>
              )}
            </div>
            {!user.emailVerified && (
              <div className="space-y-1">
                {resendSuccess ? (
                  <p className="text-xs text-emerald-400">Verification email sent.</p>
                ) : (
                  <>
                    {resendError && <p className="text-xs text-red-400">{resendError}</p>}
                    <button
                      onClick={resendVerification}
                      disabled={resending}
                      className="text-xs text-indigo-400 transition hover:text-indigo-300 disabled:opacity-50"
                    >
                      {resending ? 'Sending…' : 'Resend verification email'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Member since</span>
          <span className="font-medium">{new Date(user.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    </SectionCard>
  );
}
