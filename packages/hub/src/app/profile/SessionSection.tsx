'use client';

import { signOut } from 'next-auth/react';
import { SectionCard } from '@/components/SectionCard';
import { Button } from '@/components';

type SessionSectionProps = {
  email: string;
};

export function SessionSection({ email }: SessionSectionProps) {
  return (
    <SectionCard title="Session">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted,#a1a1aa)]">Signed in as {email}</p>
        <Button variant="secondary" size="sm" onClick={() => signOut({ callbackUrl: '/auth/signin' })}>
          Sign out
        </Button>
      </div>
    </SectionCard>
  );
}
