import { FeatureTheme } from '@/components';
import Link from 'next/link';
import { FinancesSidebar } from './FinancesSidebar';
import { FinancesBottomNav } from './FinancesBottomNav';

export default function FinancesLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureTheme feature="finances" className="flex h-screen flex-col bg-[var(--bg)]">
      {/* Breadcrumb strip */}
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--shell)] px-6">
        <div className="flex h-12 items-center gap-2.5">
          <Link href="/" className="flex items-center gap-1 text-[13px] font-medium text-[var(--accent)] no-underline">
            <span className="text-base leading-none">←</span>
            <span className="font-normal text-[var(--muted)]">Hub</span>
          </Link>
          <span className="text-sm text-[var(--border)]">/</span>
          <Link
            href="/finances"
            className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--text)] no-underline"
          >
            Finances
          </Link>
        </div>
      </div>

      {/* Sidebar + page content */}
      <div className="flex flex-1 overflow-hidden">
        <div data-layout="desktop" className="hidden md:contents">
          <FinancesSidebar />
        </div>
        <div className="flex-1 overflow-y-auto px-7 pb-20 pt-5 md:pb-12">{children}</div>
      </div>

      {/* Mobile bottom nav — hidden at md and above */}
      <div data-layout="mobile" className="md:hidden">
        <FinancesBottomNav />
      </div>
    </FeatureTheme>
  );
}
