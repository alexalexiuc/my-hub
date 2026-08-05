'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { IconButton } from '@/components/IconButton';
import { PageHeader } from '@/components/PageHeader';
import { CalendarIcon } from '@/components/icons';
import { PERIODS, PeriodReport, parsePeriodParam } from '../ReportView';

/**
 * Standalone weekly report — the "view in app" target of the emailed weekly report, which
 * deep-links it with `?weekStart=`. Without the param it opens on the finished week the email
 * covers, unlike the tabbed page which opens on the week in progress.
 */
function WeeklyReportContent() {
  const initialStart =
    parsePeriodParam(useSearchParams().get('weekStart')) ?? PERIODS.weekly.step(PERIODS.weekly.current(), -1);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-8">
      <PageHeader
        title="Weekly Report"
        backHref="/calories"
        backLabel="← Calories"
        actions={<IconButton href="/calories/reports/monthly" label="Monthly Reports" icon={<CalendarIcon />} />}
      />
      <PeriodReport config={PERIODS.weekly} initialStart={initialStart} />
    </main>
  );
}

export default function WeeklyReportPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-5xl p-8">
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        </main>
      }
    >
      <WeeklyReportContent />
    </Suspense>
  );
}
