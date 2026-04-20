'use client';

import { signOut } from 'next-auth/react';
import { SectionCard } from '@/components/SectionCard';

type SessionSectionProps = {
  email: string;
};

export function SessionSection({ email }: SessionSectionProps) {
  return (
    <SectionCard title="Session">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">Signed in as {email}</p>
        <button
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 transition hover:bg-zinc-800"
        >
          Sign out
        </button>
      </div>
    </SectionCard>
  );
}
