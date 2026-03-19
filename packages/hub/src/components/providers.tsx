'use client';

import { SessionProvider } from 'next-auth/react';
import AutoSignOut from './auto-sign-out';
import EmailVerificationBanner from './email-verification-banner';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AutoSignOut />
      <EmailVerificationBanner />
      {children}
    </SessionProvider>
  );
}
