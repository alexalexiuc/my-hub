'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { PERIODS, PeriodReport, type ReportPeriod } from './ReportView';

const TABS: ReportPeriod[] = ['weekly', 'monthly'];

function ReportsContent() {
  // The tab lives in the URL so the view can be linked and the back button steps through it —
  // this is what the Suspense boundary below is for.
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab: ReportPeriod = searchParams.get('tab') === 'monthly' ? 'monthly' : 'weekly';

  return (
    <main className="mx-auto max-w-3xl space-y-5">
      <div className="flex rounded-xl border border-[var(--border)] bg-[var(--card2)] p-1">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => router.replace(`/calories/reports?tab=${t}`, { scroll: false })}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm font-medium capitalize transition-colors',
              tab === t
                ? 'bg-[var(--card)] text-[var(--accent)] shadow-sm border border-[var(--accent)44]'
                : 'text-[var(--muted)] hover:text-[var(--text)]',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Keyed so switching tabs resets the period rather than carrying a week index into months. */}
      <PeriodReport key={tab} config={PERIODS[tab]} />
    </main>
  );
}

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl py-6">
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        </main>
      }
    >
      <ReportsContent />
    </Suspense>
  );
}
