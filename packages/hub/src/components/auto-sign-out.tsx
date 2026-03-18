'use client';

import { useEffect } from 'react';
import { signOut } from 'next-auth/react';

export default function AutoSignOut() {
  useEffect(() => {
    const original = window.fetch;
    window.fetch = async (...args) => {
      const res = await original(...args);
      if (res.status === 401) {
        signOut({ callbackUrl: '/auth/signin' });
      }
      return res;
    };
    return () => {
      window.fetch = original;
    };
  }, []);
  return null;
}
