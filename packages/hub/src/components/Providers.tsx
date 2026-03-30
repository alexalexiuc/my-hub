'use client';

import { SessionProvider } from 'next-auth/react';
import { AutoSignOut } from './AutoSignOut';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AutoSignOut />
      {children}
    </SessionProvider>
  );
}
