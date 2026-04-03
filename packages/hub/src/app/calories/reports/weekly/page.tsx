'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { IconButton } from '@/components/IconButton';
import { PageHeader } from '@/components/PageHeader';
import { CalendarIcon } from '@/components/icons';

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getLastMonday(): Date {
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayOfWeek = todayUtc.getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  todayUtc.setUTCDate(todayUtc.getUTCDate() - daysSinceMonday - 7);
  return todayUtc;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

function isoWeekAndYear(d: Date): { week: number; year: number } {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week, year: date.getUTCFullYear() };
}

function weekLabel(weekStart: Date): string {
  const { week, year } = isoWeekAndYear(weekStart);
  return `Week ${week}, ${year}`;
}

function WeeklyReportContent() {
  const searchParams = useSearchParams();

  const [weekStart, setWeekStart] = useState<Date>(() => {
    const param = searchParams.get('weekStart');
    if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) return new Date(`${param}T00:00:00Z`);
    return getLastMonday();
  });

  const [html, setHtml] = useState<string | null>(null);
  const [noData, setNoData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (date: Date) => {
    setLoading(true);
    setHtml(null);
    setNoData(false);
    setError(null);
    try {
      const res = await fetch(`/api/calories/reports/weekly-preview?weekStart=${toDateStr(date)}`);
      if (res.status === 401) {
        setError('Not signed in');
        return;
      }
      const json = (await res.json()) as { html?: string; skipped?: string };
      if (json.skipped === 'no_data') {
        setNoData(true);
        return;
      }
      setHtml(json.html ?? null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(weekStart);
  }, [weekStart, load]);

  function navigate(delta: number) {
    setWeekStart((prev) => addDays(prev, delta * 7));
  }

  return (
    <main className="mx-auto max-w-5xl p-8 space-y-4">
      <PageHeader
        title="Weekly Report"
        backHref="/calories"
        backLabel="← Calories"
        actions={<IconButton href="/calories/reports/monthly" label="Monthly Reports" icon={<CalendarIcon />} />}
      />

      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="px-3 py-1.5 rounded bg-[#13283d] border border-[#1e3a52] text-sm hover:bg-[#1a3349] transition-colors"
        >
          ← Prev
        </button>
        <span className="text-sm text-[#8ca0b5] min-w-[140px] text-center">{weekLabel(weekStart)}</span>
        <button
          onClick={() => navigate(1)}
          className="px-3 py-1.5 rounded bg-[#13283d] border border-[#1e3a52] text-sm hover:bg-[#1a3349] transition-colors"
        >
          Next →
        </button>
      </div>

      {loading && <p className="text-[#8ca0b5] text-sm">Loading…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {noData && <p className="text-[#8ca0b5] text-sm">No meals logged for this week.</p>}
      {html && (
        <iframe
          srcDoc={html}
          className="w-full border-0 rounded-lg"
          style={{ minHeight: '800px' }}
          onLoad={(e) => {
            const iframe = e.currentTarget;
            const doc = iframe.contentDocument;
            if (doc) iframe.style.height = `${doc.documentElement.scrollHeight}px`;
          }}
        />
      )}
    </main>
  );
}

export default function WeeklyReportPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-5xl p-8">
          <p className="text-[#8ca0b5] text-sm">Loading…</p>
        </main>
      }
    >
      <WeeklyReportContent />
    </Suspense>
  );
}
