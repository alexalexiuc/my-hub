import Link from 'next/link';
import { FeatureTheme } from '@/components';
import { VacationSidebar } from './VacationSidebar';
import { VacationBottomNav } from './VacationBottomNav';

export default function VacationLayout({ children }: { children: React.ReactNode }) {
  return (
    // `h-dvh`, not `h-screen`, so the bottom nav stays above mobile browser chrome (see Calories).
    <FeatureTheme feature="vacation" className="flex h-dvh flex-col bg-[var(--bg)] text-[var(--text)]">
      {/* Breadcrumb strip */}
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--shell)] px-4 md:px-6">
        <div className="flex h-12 items-center gap-2.5">
          <Link href="/" className="flex items-center gap-1 text-[13px] font-medium text-[var(--accent)] no-underline">
            <span className="text-base leading-none">←</span>
            <span className="font-normal text-[var(--muted)]">Hub</span>
          </Link>
          <span className="text-sm text-[var(--border)]">/</span>
          <Link
            href="/vacation"
            className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--text)] no-underline"
          >
            Vacation
          </Link>
        </div>
      </div>

      {/* Sidebar + page content */}
      <div className="flex flex-1 overflow-hidden">
        <div data-layout="desktop" className="hidden md:contents">
          <VacationSidebar />
        </div>
        {/* The accent wash fades into the theme's own background, so the page carries its colour
            whichever palette the user picks for Vacation. */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[var(--accent-d)] to-transparent to-50% px-4 pb-20 pt-5 md:px-7 md:pb-12">
          {children}
        </div>
      </div>

      {/* Mobile bottom nav — hidden at md and above */}
      <div data-layout="mobile" className="md:hidden">
        <VacationBottomNav />
      </div>
    </FeatureTheme>
  );
}
