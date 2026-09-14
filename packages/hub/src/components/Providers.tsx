'use client';

import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import { Toaster } from 'sonner';
import { AutoSignOut } from './AutoSignOut';
import { ThemeProvider, type ThemeOverrides } from './ThemeProvider';

export function Providers({
  children,
  themeOverrides = {},
  session,
}: {
  children: React.ReactNode;
  /** The user's stored theme overrides, resolved server-side by the root layout. */
  themeOverrides?: ThemeOverrides;
  /**
   * The session resolved server-side by the root layout. Seeding `SessionProvider` with it means
   * `useSession()` returns the real, already-known status on the very first client render instead
   * of starting at `'loading'` and re-fetching `/api/auth/session` — without it, every consumer of
   * `useSession()` sees a `'loading'` flash on every page load, not just the very first one.
   */
  session?: Session | null;
}) {
  return (
    <SessionProvider session={session}>
      <ThemeProvider initial={themeOverrides}>
        <AutoSignOut />
        {children}
        <Toaster richColors theme="dark" position="top-right" />
      </ThemeProvider>
    </SessionProvider>
  );
}
