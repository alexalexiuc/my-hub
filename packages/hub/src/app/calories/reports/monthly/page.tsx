'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { IconButton } from '@/components/IconButton';
import { PageHeader } from '@/components/PageHeader';
import { BarChartIcon } from '@/components/icons';
import { PERIODS, PeriodReport, parsePeriodParam } from '../ReportView';

/**
 * Standalone monthly report — the "view in app" target of the emailed monthly report, which
 * deep-links it with `?monthStart=`. Without the param it opens on the finished month the email
 * covers, unlike the tabbed page which opens on the month in progress.
 */
function MonthlyReportContent() {
  const initialStart =
    parsePeriodParam(useSearchParams().get('monthStart')) ?? PERIODS.monthly.step(PERIODS.monthly.current(), -1);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-8">
      <PageHeader
        title="Monthly Report"
        backHref="/calories"
        backLabel="← Calories"
        actions={<IconButton href="/calories/reports/weekly" label="Weekly Reports" icon={<BarChartIcon />} />}
      />
      <PeriodReport config={PERIODS.monthly} initialStart={initialStart} />
    </main>
  );
}

export default function MonthlyReportPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-5xl p-8">
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        </main>
      }
    >
      <MonthlyReportContent />
    </Suspense>
  );
}
