import Link from 'next/link';
import { FinancesSidebar } from './FinancesSidebar';
import './finances.css';

export default function FinancesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="finances-theme flex h-screen flex-col bg-[var(--fin-bg)]">
      {/* Breadcrumb strip */}
      <div className="shrink-0 border-b border-[var(--fin-border)] bg-[var(--fin-shell)] px-6">
        <div className="flex h-12 items-center gap-2.5">
          <Link
            href="/"
            className="flex items-center gap-1 text-[13px] font-medium text-[var(--fin-accent)] no-underline"
          >
            <span className="text-base leading-none">←</span>
            <span className="font-normal text-[var(--fin-muted)]">Hub</span>
          </Link>
          <span className="text-sm text-[var(--fin-border)]">/</span>
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--fin-text)]">Finances</span>
        </div>
      </div>

      {/* Sidebar + page content */}
      <div className="flex flex-1 overflow-hidden">
        <FinancesSidebar />
        <div className="flex-1 overflow-y-auto px-7 pb-12 pt-5">{children}</div>
      </div>
    </div>
  );
}
