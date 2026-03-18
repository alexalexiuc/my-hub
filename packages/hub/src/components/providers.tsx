'use client';

import { SessionProvider } from 'next-auth/react';
import AutoSignOut from './auto-sign-out';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AutoSignOut />
      {children}
    </SessionProvider>
  );
}
