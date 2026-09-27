'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { VacationBalanceResult, VacationCalendarResult } from '@my-hub/shared/services';
import { buildMonthGridDays, dateToString, formatMonthStr, shiftMonthStr } from '@my-hub/shared/utils';
import { Card, Checkbox, IconButton, PageHeader } from '@/components';
import { ChevronLeftOutlineIcon, ChevronRightOutlineIcon } from '@/components/icons';
import { apiFetch, ApiError } from '@/lib/utils';
import { VacationMonthGrid } from './VacationMonthGrid';
import { SelectionPanel } from './SelectionPanel';
import { formatDays, normalizeRange } from './vacation.utils';

export default function VacationPage() {
  const today = dateToString(new Date());
  const [month, setMonth] = useState(today.slice(0, 7));
  const [includeDraftRules, setIncludeDraftRules] = useState(false);
  const [calendar, setCalendar] = useState<VacationCalendarResult | null>(null);
  const [balance, setBalance] = useState<VacationBalanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<[string, string] | null>(null);

  const days = useMemo(() => buildMonthGridDays(month), [month]);
  const rows = useMemo(() => new Map((calendar?.rows ?? []).map(r => [r[0], r])), [calendar]);

  const load = useCallback(async () => {
    try {
      const [cal, bal] = await Promise.all([
        apiFetch<VacationCalendarResult>('/api/vacation/calendar', {
          query: { month, includeDraftRules },
          silentToast: true,
        }),
        apiFetch<VacationBalanceResult>('/api/vacation/balance', {
          query: { date: today, includeDraftRules },
          silentToast: true,
        }),
      ]);
      setCalendar(cal);
      setBalance(bal);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load the vacation calendar.');
    }
  }, [month, includeDraftRules, today]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedDayRow = selection && selection[0] === selection[1] ? rows.get(selection[0]) : undefined;

  return (
    <main className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Calendar" />

      {error ? (
        <Card compact>
          <p className="text-sm text-[var(--muted)]">{error}</p>
          <p className="mt-2 text-xs text-[var(--subtle)]">
            Fill in your{' '}
            <Link href="/vacation/profile" className="text-[var(--accent)]">
              Profile
            </Link>{' '}
            and{' '}
            <Link href="/vacation/payments" className="text-[var(--accent)]">
              Payments
            </Link>
            , or ask Claude to run vacation_setup through the Vacation MCP.
          </p>
        </Card>
      ) : (
        <>
          {calendar?.demo && (
            <Card compact className="border-[var(--amber)] md:border-[var(--amber)]">
              <p className="text-sm font-semibold text-[var(--amber)]">Demo data</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                You have no vacation profile yet, so this calendar runs on sample salaries and leave. Fill in your{' '}
                <Link href="/vacation/profile" className="text-[var(--accent)]">
                  Profile
                </Link>{' '}
                and{' '}
                <Link href="/vacation/payments" className="text-[var(--accent)]">
                  Payments
                </Link>
                , or ask Claude to set everything up through the Vacation MCP (vacation_setup), to see your own numbers.
              </p>
            </Card>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <IconButton
                label="Previous month"
                icon={<ChevronLeftOutlineIcon className="size-4" />}
                onClick={() => setMonth(m => shiftMonthStr(m, -1))}
              />
              <span className="min-w-32 text-center text-sm font-semibold">{formatMonthStr(month)}</span>
              <IconButton
                label="Next month"
                icon={<ChevronRightOutlineIcon className="size-4" />}
                onClick={() => setMonth(m => shiftMonthStr(m, 1))}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--muted)]">
              <Checkbox checked={includeDraftRules} onChange={e => setIncludeDraftRules(e.target.checked)} />
              Preview draft rules (2027 reform)
            </label>
          </div>

          {balance && (
            <p className="text-sm text-[var(--muted)]">
              Balance today: <span className="font-semibold text-[var(--text)]">{formatDays(balance.totalDays)}</span>
              {balance.buckets.length > 1 &&
                ` (${balance.buckets.map(b => `${b.days} ${b.leaveUnit} — ${b.ruleSetName}`).join('; ')})`}
            </p>
          )}

          <VacationMonthGrid
            days={days}
            rows={rows}
            today={today}
            selection={selection}
            onSelect={(a, b) => setSelection(normalizeRange(a, b))}
          />

          <p className="text-xs text-[var(--subtle)]">
            Each day shows net money vs working it, if a leave starting that month covers it. Tap a day, or drag across
            days to price a whole span.
          </p>

          {selection && (
            <SelectionPanel range={selection} dayRow={selectedDayRow} includeDraftRules={includeDraftRules} />
          )}

          {calendar && calendar.warnings.length > 0 && (
            <ul className="list-disc space-y-1 pl-4 text-xs text-[var(--amber)]">
              {calendar.warnings.map(w => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
