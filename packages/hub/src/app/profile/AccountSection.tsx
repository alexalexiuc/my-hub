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
          <span className="text-[var(--muted,#a1a1aa)]">Email</span>
          <div className="space-y-1 text-right">
            <div className="flex items-center justify-end gap-2">
              <span className="font-medium">{user.email}</span>
              {user.emailVerified ? (
                <span className="rounded border border-[var(--green,#6ee7b7)]/40 bg-[var(--green-d,rgba(110,231,183,0.1))] px-1.5 py-0.5 text-xs text-[var(--green,#6ee7b7)]">
                  Verified
                </span>
              ) : (
                <span className="rounded border border-[var(--amber,#fcd34d)]/40 bg-[var(--amber-d,rgba(252,211,77,0.1))] px-1.5 py-0.5 text-xs text-[var(--amber,#fcd34d)]">
                  Unverified
                </span>
              )}
            </div>
            {!user.emailVerified && (
              <div className="space-y-1">
                {resendSuccess ? (
                  <p className="text-xs text-[var(--green,#6ee7b7)]">Verification email sent.</p>
                ) : (
                  <>
                    {resendError && <p className="text-xs text-[var(--red,#f87171)]">{resendError}</p>}
                    <button
                      onClick={resendVerification}
                      disabled={resending}
                      className="text-xs text-[var(--accent)] transition hover:opacity-80 disabled:opacity-50"
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
          <span className="text-[var(--muted,#a1a1aa)]">Member since</span>
          <span className="font-medium">{new Date(user.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    </SectionCard>
  );
}
