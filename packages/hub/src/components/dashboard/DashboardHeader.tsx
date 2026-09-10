'use client';

import { signOut } from 'next-auth/react';
import { IconButton } from '@/components';
import { UserOutlineIcon, LogOutOutlineIcon, SwatchOutlineIcon } from '@/components/icons';
import { useUserNameFromSession } from '@/hooks/useUserNameFromSession';

export function DashboardHeader() {
  const { fullName, status } = useUserNameFromSession();

  return (
    <header className="border-b border-[var(--border,#27272a)] bg-[var(--bg,#09090b)]">
      <div className="mx-auto max-w-5xl flex items-center justify-between px-4 sm:px-8 py-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text,#f4f4f5)]">My Hub</h1>
          {status === 'loading' ? (
            <div className="mt-1 h-3.5 w-28 rounded bg-[var(--card2,#27272a)] animate-pulse" />
          ) : (
            fullName && <p className="text-sm text-[var(--muted,#a1a1aa)]">Welcome, {fullName}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            label="Appearance"
            icon={<SwatchOutlineIcon className="size-5" />}
            href="/appearance"
            variant="ghost"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-[var(--card2,#27272a)]"
          />
          <IconButton
            label="Profile & Settings"
            icon={<UserOutlineIcon className="size-5" />}
            href="/profile"
            variant="ghost"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-[var(--card2,#27272a)]"
          />
          <IconButton
            label="Sign out"
            icon={<LogOutOutlineIcon className="size-5" />}
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            variant="ghost"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-[var(--card2,#27272a)]"
          />
        </div>
      </div>
    </header>
  );
}
