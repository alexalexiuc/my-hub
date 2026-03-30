'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';

interface DashboardHeaderProps {
  userName: string | null;
}

export function DashboardHeader({ userName }: DashboardHeaderProps) {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950">
      <div className="mx-auto max-w-5xl flex items-center justify-between px-4 sm:px-8 py-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Hub</h1>
          {userName && <p className="text-sm text-zinc-400">Welcome, {userName}</p>}
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/profile"
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
            title="Profile & Settings"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M20 21a8 8 0 0 0-16 0" />
            </svg>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
            title="Sign out"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
