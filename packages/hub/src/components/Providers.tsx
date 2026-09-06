'use client';

import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'sonner';
import { AutoSignOut } from './AutoSignOut';
import { ThemeProvider, type ThemeOverrides } from './ThemeProvider';

export function Providers({
  children,
  themeOverrides = {},
}: {
  children: React.ReactNode;
  /** The user's stored theme overrides, resolved server-side by the root layout. */
  themeOverrides?: ThemeOverrides;
}) {
  return (
    <SessionProvider>
      <ThemeProvider initial={themeOverrides}>
        <AutoSignOut />
        {children}
        <Toaster richColors theme="dark" position="top-right" />
      </ThemeProvider>
    </SessionProvider>
  );
}
