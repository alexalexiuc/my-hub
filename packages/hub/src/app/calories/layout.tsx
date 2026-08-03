import Link from 'next/link';
import { CaloriesSidebar } from './CaloriesSidebar';
import { CaloriesBottomNav } from './CaloriesBottomNav';

export default function CaloriesLayout({ children }: { children: React.ReactNode }) {
  return (
    // `h-dvh`, not `h-screen`: `100vh` on mobile browsers is the height with the URL bar retracted,
    // so a full-height column overshoots the visible area and pushes its bottom under the browser
    // chrome. The dynamic unit tracks the bar as it collapses.
    <div className="calories-theme flex h-dvh flex-col bg-[var(--bg)]">
      {/* Breadcrumb strip */}
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--shell)] px-4 md:px-6">
        <div className="flex h-12 items-center gap-2.5">
          <Link href="/" className="flex items-center gap-1 text-[13px] font-medium text-[var(--accent)] no-underline">
            <span className="text-base leading-none">←</span>
            <span className="font-normal text-[var(--muted)]">Hub</span>
          </Link>
          <span className="text-sm text-[var(--border)]">/</span>
          <Link
            href="/calories"
            className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--text)] no-underline"
          >
            Calories
          </Link>
        </div>
      </div>

      {/* Sidebar + page content */}
      <div className="flex flex-1 overflow-hidden">
        <div data-layout="desktop" className="hidden md:contents">
          <CaloriesSidebar />
        </div>
        {/* Narrower gutters on phones: 28px a side took 17% of a 320px screen away from content. */}
        <div className="flex-1 overflow-y-auto px-4 pb-20 pt-5 md:px-7 md:pb-12">{children}</div>
      </div>

      {/* Mobile bottom nav — hidden at md and above */}
      <div data-layout="mobile" className="md:hidden">
        <CaloriesBottomNav />
      </div>
    </div>
  );
}
