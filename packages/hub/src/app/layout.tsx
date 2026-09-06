import '@/styles/globals.css';
import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Providers } from '@/components';
import type { ThemeOverrides } from '@/components';
import { getAuthUser } from '@/lib/auth-user';
import { getUserThemePreferences } from '@my-hub/shared/services';
import { DEFAULT_THEME_BY_SCOPE, themeClassName } from '@my-hub/shared/constants';

export const metadata: Metadata = {
  title: 'My Hub',
  description: 'Personal platform admin panel',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'My Hub',
  },
};

export const viewport: Viewport = {
  // Only the visual viewport shrinks when the virtual keyboard appears;
  // the layout viewport (and thus fixed-position elements) stays unchanged.
  // Prevents fixed modals from jumping when keyboard opens on Android Chrome.
  interactiveWidget: 'resizes-visual',
};

/**
 * Reads the signed-in user's stored theme overrides. Returns an empty map when signed out or on
 * any failure — theming must never be able to break the shell, and an empty map resolves to the
 * shipped defaults.
 */
async function readThemeOverrides(): Promise<ThemeOverrides> {
  try {
    const user = await getAuthUser();
    if (!user) return {};
    const rows = await getUserThemePreferences(user.id);
    return Object.fromEntries(rows.map(({ scope, themeKey }) => [scope, themeKey]));
  } catch {
    return {};
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Opts the layout into dynamic rendering so Next.js can read the x-nonce
  // request header (set by proxy.ts) and inject it into its inline bootstrap scripts.
  await headers();

  // Resolved on the server so the very first paint already carries the right palette — a
  // client-side application would flash the default theme first.
  const themeOverrides = await readThemeOverrides();
  const globalTheme = themeOverrides.global ?? DEFAULT_THEME_BY_SCOPE.global;

  return (
    <html lang="en">
      <body className={`${themeClassName(globalTheme)} min-h-screen bg-[var(--bg)] text-[var(--text)]`}>
        <Providers themeOverrides={themeOverrides}>{children}</Providers>
      </body>
    </html>
  );
}
