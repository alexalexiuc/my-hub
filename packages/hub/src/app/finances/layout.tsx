import Link from 'next/link';
import { FinancesSidebar } from './FinancesSidebar';

export default function FinancesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#0e0e12',
      }}
    >
      {/* Breadcrumb strip */}
      <div
        style={{
          background: '#111116',
          borderBottom: '1px solid #35354a',
          padding: '0 24px',
          flexShrink: 0,
        }}
      >
        <div style={{ height: 48, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link
            href="/"
            style={{
              color: '#a78bfa',
              fontSize: 13,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              textDecoration: 'none',
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>←</span>
            <span style={{ color: '#9898b0', fontWeight: 400 }}>Hub</span>
          </Link>
          <span style={{ color: '#35354a', fontSize: 14 }}>/</span>
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-.01em', color: '#f2f2f8' }}>Finances</span>
        </div>
      </div>

      {/* Sidebar + page content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <FinancesSidebar />
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px 48px' }}>{children}</div>
      </div>
    </div>
  );
}
