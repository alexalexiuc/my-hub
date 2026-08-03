'use client';

import { useEffect, useRef, useState } from 'react';
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
import { isoDateSchema } from '@/lib/schemas/common';
import { PeriodNav } from '../ui';

export type ReportPeriod = 'weekly' | 'monthly';

/** The Monday of the current week, and the first of the current month — in the UTC terms the report endpoints use. */
export const currentWeekStart = () => addDays(getLastMonday(), 7);
export const currentMonthStart = () => addMonths(getLastMonthStart(), 1);

/**
 * What differs between the weekly and monthly views. Everything else about them is identical, so
 * they are one component driven by this table rather than several that have to be edited in step.
 */
export type PeriodConfig = {
  endpoint: string;
  param: string;
  current: () => Date;
  step: (from: Date, direction: 1 | -1) => Date;
  label: (date: Date) => string;
  currentLabel: string;
  emptyMessage: string;
  minHeight: number;
};

export const PERIODS: Record<ReportPeriod, PeriodConfig> = {
  weekly: {
    endpoint: '/api/calories/reports/weekly-preview',
    param: 'weekStart',
    current: currentWeekStart,
    step: (from, direction) => addDays(from, 7 * direction),
    label: weekLabel,
    currentLabel: 'This week',
    emptyMessage: 'No meals logged for this week.',
    minHeight: 800,
  },
  monthly: {
    endpoint: '/api/calories/reports/monthly-preview',
    param: 'monthStart',
    current: currentMonthStart,
    step: (from, direction) => addMonths(from, direction),
    label: monthLabel,
    currentLabel: 'This month',
    emptyMessage: 'No meals logged for this month.',
    minHeight: 900,
  },
};

/**
 * The rendered report. The document is an email template built out of fixed-width tables, so on a
 * narrow screen it is wider than the frame — clipping the last stat column with no way to reach
 * it. Rather than fight the template, the frame is widened to its content and the wrapper scrolls.
 */
export function ReportFrame({ html, minHeight }: { html: string; minHeight: number }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  return (
    <div className="space-y-1.5">
      <div ref={wrapperRef} className="overflow-x-auto rounded-xl">
        <iframe
          srcDoc={html}
          title="Report preview"
          className="w-full border-0"
          style={{ minHeight }}
          onLoad={e => {
            const iframe = e.currentTarget;
            const doc = iframe.contentDocument;
            if (!doc) return;
            const available = wrapperRef.current?.clientWidth ?? iframe.clientWidth;
            const contentWidth = doc.documentElement.scrollWidth;
            iframe.style.width = `${Math.max(available, contentWidth)}px`;
            iframe.style.height = `${doc.documentElement.scrollHeight}px`;
            setOverflows(contentWidth > available);
          }}
        />
      </div>
      {/* A scrollable box with nothing spilling into view gives no sign that it scrolls, and the
          report is exactly the kind of content a reader assumes they have seen all of. */}
      {overflows && (
        <p className="text-center text-[11px] text-[var(--subtle)]">Scroll sideways to see the full report</p>
      )}
    </div>
  );
}

/**
 * One period's report plus its stepper, shared by the tabbed reports page and the two standalone
 * pages the emailed reports deep-link into.
 *
 * `initialStart` is what the deep link carries; without one the tabbed page opens on the period in
 * progress, while a standalone page opens on the finished period its email covers.
 */
export function PeriodReport({ config, initialStart }: { config: PeriodConfig; initialStart?: Date }) {
  const [start, setStart] = useState<Date>(() => initialStart ?? config.current());
  const [html, setHtml] = useState<string | null>(null);
  const [noData, setNoData] = useState(false);
  const [loading, setLoading] = useState(true);
  const isCurrent = toUTCDateStr(start) === toUTCDateStr(config.current());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setHtml(null);
    setNoData(false);
    apiFetch<{ html?: string; skipped?: string }>(config.endpoint, {
      query: { [config.param]: toUTCDateStr(start) },
    })
      .then(json => {
        if (cancelled) return;
        if (json.skipped === 'no_data') setNoData(true);
        else setHtml(json.html ?? null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [config, start]);

  return (
    <div className="space-y-4">
      <PeriodNav
        label={isCurrent ? config.currentLabel : config.label(start)}
        isCurrent={isCurrent}
        onPrev={() => setStart(prev => config.step(prev, -1))}
        onNext={() => setStart(prev => config.step(prev, 1))}
      />
      {loading && <p className="text-sm text-[var(--muted)]">Loading…</p>}
      {noData && <p className="text-sm text-[var(--muted)]">{config.emptyMessage}</p>}
      {html && <ReportFrame html={html} minHeight={config.minHeight} />}
    </div>
  );
}

/**
 * Reads a YYYY-MM-DD deep-link param as a UTC date, ignoring anything malformed. The shape is
 * validated with the same schema the API routes use, so it can't drift between the link the
 * worker emails out and the endpoint that answers it.
 *
 * The calendar check is separate and not redundant, and it round-trips rather than just testing
 * for NaN. The schema is a regex, so "2026-13-45" has the right shape and yields an Invalid Date
 * — which reaches `toUTCDateStr` during render, where `toISOString` throws and takes the page
 * down. And "2026-02-31" is worse than invalid: JS rolls it over to March 3, so a NaN check
 * passes it and the reader is shown a different period than the link asked for, with no sign
 * anything was wrong. Returning the date the link named, or nothing, is the only honest answer.
 */
export function parsePeriodParam(value: string | null): Date | undefined {
  if (!isoDateSchema.safeParse(value).success) return undefined;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return toUTCDateStr(parsed) === value ? parsed : undefined;
}
