'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { UserOutlineIcon, LogOutOutlineIcon } from '@/components/icons';
import { useUserNameFromSession } from '@/hooks/useUserNameFromSession';

export function DashboardHeader() {
  const { fullName, status } = useUserNameFromSession();

  return (
    <header className="border-b border-zinc-800 bg-zinc-950">
      <div className="mx-auto max-w-5xl flex items-center justify-between px-4 sm:px-8 py-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Hub</h1>
          {status === 'loading' ? (
            <div className="mt-1 h-3.5 w-28 rounded bg-zinc-800 animate-pulse" />
          ) : (
            fullName && <p className="text-sm text-zinc-400">Welcome, {fullName}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/profile"
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
            title="Profile & Settings"
          >
            <UserOutlineIcon className="size-5" />
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
            title="Sign out"
          >
            <LogOutOutlineIcon className="size-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
