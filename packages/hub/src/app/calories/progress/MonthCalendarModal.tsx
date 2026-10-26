'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components';
import { ChevronLeftOutlineIcon } from '@/components/icons';
import type { CalorieProfile } from '@my-hub/shared/types';
import { buildMonthGridDays, dateToString, formatMonthStr, shiftMonthStr } from '@my-hub/shared/utils';
import { currentMonthStr } from '../calendar/calendar.utils';
import { MonthGrid } from '../calendar/MonthGrid';
import { DayDetail } from '../calendar/DayDetail';
import { useCalendarDays } from '../calendar/useCalendarDays';
import { formatDateLabel } from '../calories.utils';
import { PeriodNav } from '../ui';
import { MonthLegend } from './MonthLegend';

type MonthCalendarModalProps = {
  profile: CalorieProfile | null;
  onClose: () => void;
};

/**
 * The month calendar, opened from Progress. Tapping a day swaps the modal to that day's detail,
 * with a back link to the month, instead of stacking a second modal on top of this one.
 */
export function MonthCalendarModal({ profile, onClose }: MonthCalendarModalProps) {
  const thisMonth = currentMonthStr();
  const today = dateToString(new Date());
  const [month, setMonth] = useState(thisMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { days: summaries } = useCalendarDays({ month });

  const days = useMemo(() => buildMonthGridDays(month), [month]);
  const summaryByDate = useMemo(() => new Map((summaries ?? []).map(s => [s.date, s])), [summaries]);

  const monthName = formatMonthStr(month).split(' ')[0];

  return (
    <Modal
      title={selectedDate ? formatDateLabel(selectedDate) : 'Month calendar'}
      onClose={onClose}
      className="md:max-w-[560px]"
    >
      {selectedDate ? (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setSelectedDate(null)}
            className="flex min-h-[44px] items-center gap-1 self-start text-sm font-semibold text-[var(--accent)] hover:underline"
          >
            <ChevronLeftOutlineIcon className="size-4" />
            {monthName}
          </button>
          <DayDetail
            key={selectedDate}
            date={selectedDate}
            summary={summaryByDate.get(selectedDate)}
            profile={profile}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <PeriodNav
            compact
            label={month === thisMonth ? 'This month' : formatMonthStr(month)}
            isCurrent={month === thisMonth}
            onPrev={() => setMonth(m => shiftMonthStr(m, -1))}
            onNext={() => setMonth(m => shiftMonthStr(m, 1))}
          />
          {summaries === null ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : (
            <MonthGrid days={days} summaries={summaryByDate} today={today} onSelectDay={setSelectedDate} />
          )}
          <MonthLegend />
          <p className="text-xs text-[var(--muted)]">Tap a day to see its meals.</p>
        </div>
      )}
    </Modal>
  );
}
