'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/utils';
import {
  addDays,
  addMonths,
  getLastMonday,
  getLastMonthStart,
  toUTCDateStr,
  weekLabel,
  monthLabel,
} from '@my-hub/shared/utils';
import { cn } from '@/lib/utils';

type Tab = 'weekly' | 'monthly';

function WeeklyContent() {
  const [weekStart, setWeekStart] = useState<Date>(getLastMonday);
  const [html, setHtml] = useState<string | null>(null);
  const [noData, setNoData] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (date: Date) => {
    setLoading(true);
    setHtml(null);
    setNoData(false);
    try {
      const json = await apiFetch<{ html?: string; skipped?: string }>('/api/calories/reports/weekly-preview', {
        query: { weekStart: toUTCDateStr(date) },
      });
      if (json.skipped === 'no_data') {
        setNoData(true);
        return;
      }
      setHtml(json.html ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(weekStart);
  }, [weekStart, load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setWeekStart(prev => addDays(prev, -7))}
          className="rounded-lg border border-[var(--border)] bg-[var(--card2)] px-3 py-1.5 text-sm text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          ← Prev
        </button>
        <span className="min-w-[150px] text-center text-sm text-[var(--muted)]">{weekLabel(weekStart)}</span>
        <button
          onClick={() => setWeekStart(prev => addDays(prev, 7))}
          className="rounded-lg border border-[var(--border)] bg-[var(--card2)] px-3 py-1.5 text-sm text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          Next →
        </button>
      </div>

      {loading && <p className="text-sm text-[var(--muted)]">Loading…</p>}
      {noData && <p className="text-sm text-[var(--muted)]">No meals logged for this week.</p>}
      {html && (
        <iframe
          srcDoc={html}
          className="w-full rounded-xl border-0"
          style={{ minHeight: '800px' }}
          onLoad={e => {
            const iframe = e.currentTarget;
            const doc = iframe.contentDocument;
            if (doc) iframe.style.height = `${doc.documentElement.scrollHeight}px`;
          }}
        />
      )}
    </div>
  );
}

function MonthlyContent() {
  const [monthStart, setMonthStart] = useState<Date>(getLastMonthStart);
  const [html, setHtml] = useState<string | null>(null);
  const [noData, setNoData] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (date: Date) => {
    setLoading(true);
    setHtml(null);
    setNoData(false);
    try {
      const json = await apiFetch<{ html?: string; skipped?: string }>('/api/calories/reports/monthly-preview', {
        query: { monthStart: toUTCDateStr(date) },
      });
      if (json.skipped === 'no_data') {
        setNoData(true);
        return;
      }
      setHtml(json.html ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(monthStart);
  }, [monthStart, load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setMonthStart(prev => addMonths(prev, -1))}
          className="rounded-lg border border-[var(--border)] bg-[var(--card2)] px-3 py-1.5 text-sm text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          ← Prev
        </button>
        <span className="min-w-[160px] text-center text-sm text-[var(--muted)]">{monthLabel(monthStart)}</span>
        <button
          onClick={() => setMonthStart(prev => addMonths(prev, 1))}
          className="rounded-lg border border-[var(--border)] bg-[var(--card2)] px-3 py-1.5 text-sm text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          Next →
        </button>
      </div>

      {loading && <p className="text-sm text-[var(--muted)]">Loading…</p>}
      {noData && <p className="text-sm text-[var(--muted)]">No meals logged for this month.</p>}
      {html && (
        <iframe
          srcDoc={html}
          className="w-full rounded-xl border-0"
          style={{ minHeight: '900px' }}
          onLoad={e => {
            const iframe = e.currentTarget;
            const doc = iframe.contentDocument;
            if (doc) iframe.style.height = `${doc.documentElement.scrollHeight}px`;
          }}
        />
      )}
    </div>
  );
}

function ReportsContent() {
  const [tab, setTab] = useState<Tab>('weekly');

  return (
    <main className="mx-auto max-w-3xl space-y-5">
      {/* Tab toggle */}
      <div className="flex rounded-xl border border-[var(--border)] bg-[var(--card2)] p-1">
        {(['weekly', 'monthly'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
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

      {tab === 'weekly' ? <WeeklyContent /> : <MonthlyContent />}
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
