'use client';

import { useEffect } from 'react';
import { signOut } from 'next-auth/react';

export default function AutoSignOut() {
  useEffect(() => {
    let signingOut = false;
    const original = window.fetch;
    window.fetch = async (...args) => {
      const res = await original(...args);
      if (res.status === 401 && !signingOut) {
        const url = args[0] instanceof Request ? args[0].url : String(args[0]);
        // Skip NextAuth's own internal requests to avoid sign-out loops
        if (!url.includes('/api/auth/')) {
          signingOut = true;
          signOut({ callbackUrl: '/auth/signin' });
        }
      }
      return res;
    };
    return () => {
      window.fetch = original;
    };
  }, []);
  return null;
}
