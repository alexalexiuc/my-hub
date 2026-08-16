'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { shiftMonthStr, formatMonthStr, dateToString } from '@my-hub/shared/utils';
import { PeriodNav } from '../ui';
import { mealEvents } from '../mealEvents';
import { currentMonthStr, buildMonthGridDays } from './calendar.utils';
import { MonthGrid } from './MonthGrid';
import { DayDetailModal } from './DayDetailModal';
import type { CalendarDay } from './types';

export default function CalendarPage() {
  const thisMonth = currentMonthStr();
  const todayDate = dateToString(new Date());
  const [month, setMonth] = useState(thisMonth);
  const [summaries, setSummaries] = useState<CalendarDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isCurrentMonth = month === thisMonth;
  const days = useMemo(() => buildMonthGridDays(month), [month]);
  const summaryByDate = useMemo(() => new Map(summaries.map(s => [s.date, s])), [summaries]);

  const loadMonth = useCallback(async () => {
    try {
      const data = await apiFetch<{ days: CalendarDay[] }>('/api/calories/calendar', { query: { month } });
      setSummaries(data.days);
    } catch {
      // ignore — stale totals are acceptable on a silent refresh
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    setLoading(true);
    void loadMonth();
  }, [loadMonth]);

  useEffect(() => {
    mealEvents.on('changed', loadMonth);
    return () => mealEvents.off('changed', loadMonth);
  }, [loadMonth]);

  return (
    <main className="mx-auto max-w-2xl space-y-4">
      <PeriodNav
        compact
        label={formatMonthStr(month)}
        isCurrent={isCurrentMonth}
        onPrev={() => setMonth(m => shiftMonthStr(m, -1))}
        onNext={() => setMonth(m => shiftMonthStr(m, 1))}
      />

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : (
        <MonthGrid days={days} summaries={summaryByDate} today={todayDate} onSelectDay={setSelectedDate} />
      )}

      {selectedDate && (
        <DayDetailModal
          date={selectedDate}
          summary={summaryByDate.get(selectedDate)}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </main>
  );
}
