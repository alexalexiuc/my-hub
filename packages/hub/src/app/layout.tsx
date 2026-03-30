import '@/styles/globals.css';
import type { Metadata } from 'next';
import { Providers } from '@/components';

export const metadata: Metadata = {
  title: 'My Hub',
  description: 'Personal platform admin panel',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
