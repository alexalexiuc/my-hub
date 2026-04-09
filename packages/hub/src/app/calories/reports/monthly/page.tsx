'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { apiFetch, ApiError } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';
import { addMonths, getLastMonthStart, monthLabel, toUTCDateStr } from '@my-hub/shared/utils';
import { IconButton } from '@/components/IconButton';
import { PageHeader } from '@/components/PageHeader';
import { BarChartIcon } from '@/components/icons';

function MonthlyReportContent() {
  const searchParams = useSearchParams();

  const [monthStart, setMonthStart] = useState<Date>(() => {
    const param = searchParams.get('monthStart');
    if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) return new Date(`${param}T00:00:00Z`);
    return getLastMonthStart();
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
      const json = await apiFetch<{ html?: string; skipped?: string }>('/api/calories/reports/monthly-preview', {
        query: { monthStart: toUTCDateStr(date) },
      });
      if (json.skipped === 'no_data') {
        setNoData(true);
        return;
      }
      setHtml(json.html ?? null);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? 'Not signed in' : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(monthStart);
  }, [monthStart, load]);

  function navigate(delta: number) {
    setMonthStart((prev) => addMonths(prev, delta));
  }

  return (
    <main className="mx-auto max-w-5xl p-8 space-y-4">
      <PageHeader
        title="Monthly Report"
        backHref="/calories"
        backLabel="← Calories"
        actions={<IconButton href="/calories/reports/weekly" label="Weekly Reports" icon={<BarChartIcon />} />}
      />

      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="px-3 py-1.5 rounded bg-[#13283d] border border-[#1e3a52] text-sm hover:bg-[#1a3349] transition-colors"
        >
          ← Prev
        </button>
        <span className="text-sm text-[#8ca0b5] min-w-[160px] text-center">{monthLabel(monthStart)}</span>
        <button
          onClick={() => navigate(1)}
          className="px-3 py-1.5 rounded bg-[#13283d] border border-[#1e3a52] text-sm hover:bg-[#1a3349] transition-colors"
        >
          Next →
        </button>
      </div>

      {loading && <p className="text-[#8ca0b5] text-sm">Loading…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {noData && <p className="text-[#8ca0b5] text-sm">No meals logged for this month.</p>}
      {html && (
        <iframe
          srcDoc={html}
          className="w-full border-0 rounded-lg"
          style={{ minHeight: '900px' }}
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

export default function MonthlyReportPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-5xl p-8">
          <p className="text-[#8ca0b5] text-sm">Loading…</p>
        </main>
      }
    >
      <MonthlyReportContent />
    </Suspense>
  );
}
