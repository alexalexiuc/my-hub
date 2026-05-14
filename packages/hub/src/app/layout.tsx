import '@/styles/globals.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Providers } from '@/components';

export const metadata: Metadata = {
  title: 'My Hub',
  description: 'Personal platform admin panel',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'My Hub',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Opts the layout into dynamic rendering so Next.js can read the x-nonce
  // request header (set by proxy.ts) and inject it into its inline bootstrap scripts.
  await headers();

  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
