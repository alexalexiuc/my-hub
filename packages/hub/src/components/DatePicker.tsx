'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { Input } from '@/components/Input';
import { ChevronLeftOutlineIcon, ChevronRightOutlineIcon, ChevronDownOutlineIcon } from '@/components/icons';
import { shiftMonthStr, formatMonthStr, addDays, dateToString } from '@my-hub/shared/utils';

export type DateMode = 'month' | 'range' | 'all' | 'day';

export type DatePickerProps = {
  month: string;
  onChange: (patch: { dateMode?: DateMode; month?: string; day?: string; fromDate?: string; toDate?: string }) => void;
  /** Shows a "Today" pill when the displayed month differs from this value. */
  currentMonth?: string;
  /** Disables the forward arrow once month reaches this value. */
  maxMonth?: string;
  /** When true, adds Date range and All time tabs to the dropdown. Default: false. */
  extendedFilters?: boolean;
  /** Required when extendedFilters is true. */
  dateMode?: DateMode;
  fromDate?: string;
  toDate?: string;
  className?: string;
  labelClassName?: string;
};

/** Shifts a YYYY-MM-DD string by n days. */
function shiftDayStr(date: string, n: number): string {
  return dateToString(addDays(new Date(date + 'T12:00:00'), n));
}

/** Formats a YYYY-MM-DD string as "Today", "Yesterday", or "Weekday Mon D". */
function formatDayStr(date: string): string {
  const today = dateToString(new Date());
  const yesterday = shiftDayStr(today, -1);
  if (date === today) return 'Today';
  if (date === yesterday) return 'Yesterday';
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDateRange(from: string, to: string): string {
  if (!from && !to) return 'Select range';
  const fmt = (d: string) => {
    if (!d) return '…';
    const [, m, day] = d.split('-');
    return `${MONTH_NAMES[parseInt(m ?? '1') - 1]} ${parseInt(day ?? '1')}`;
  };
  const year = (from || to).split('-')[0] ?? '';
  if (from && to) return `${fmt(from)} – ${fmt(to)}, ${year}`;
  if (from) return `From ${fmt(from)}, ${year}`;
  return `Until ${fmt(to)}, ${year}`;
}

export function DatePicker({
  month,
  onChange,
  currentMonth,
  maxMonth,
  extendedFilters = false,
  dateMode = 'month',
  fromDate = '',
  toDate = '',
  className,
  labelClassName,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<DateMode>(dateMode);
  const [pickerYear, setPickerYear] = useState(() => parseInt(month.slice(0, 4)));
  const [rangeFrom, setRangeFrom] = useState(fromDate);
  const [rangeTo, setRangeTo] = useState(toDate);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTab(dateMode);
  }, [dateMode]);
  useEffect(() => {
    setPickerYear(parseInt(month.slice(0, 4)));
  }, [month]);
  useEffect(() => {
    setRangeFrom(fromDate);
  }, [fromDate]);
  useEffect(() => {
    setRangeTo(toDate);
  }, [toDate]);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selectedYear = parseInt(month.slice(0, 4));
  const selectedMonthIdx = parseInt(month.slice(5, 7)) - 1;

  function selectMonth(idx: number) {
    const newMonth = `${pickerYear}-${String(idx + 1).padStart(2, '0')}`;
    onChange({ dateMode: 'month', month: newMonth });
    setOpen(false);
  }

  function applyRange() {
    onChange({ dateMode: 'range', fromDate: rangeFrom, toDate: rangeTo });
    setOpen(false);
  }

  const displayLabel =
    dateMode === 'all'
      ? 'All time'
      : dateMode === 'range'
        ? formatDateRange(fromDate, toDate)
        : dateMode === 'day'
          ? formatDayStr(month)
          : formatMonthStr(month);

  const bigChevron = !!labelClassName;

  return (
    <div ref={ref} className={cn('relative flex items-center gap-2', className)}>
      {(dateMode === 'month' || dateMode === 'day') && (
        <IconButton
          label={dateMode === 'day' ? 'Previous day' : 'Previous month'}
          icon={<ChevronLeftOutlineIcon />}
          onClick={() =>
            dateMode === 'day'
              ? onChange({ day: shiftDayStr(month, -1) })
              : onChange({ month: shiftMonthStr(month, -1) })
          }
          className="bg-transparent text-[var(--muted)] hover:bg-transparent hover:text-[var(--text)]"
        />
      )}

      {extendedFilters || dateMode === 'day' ? (
        /* Clickable label with dropdown */
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1 rounded-lg px-1 py-0.5 transition-colors hover:bg-[var(--card2)]"
        >
          <span className={cn('min-w-44 font-bold tracking-tight text-[var(--text)]', labelClassName ?? 'text-[22px]')}>
            {displayLabel}
          </span>
          {dateMode !== 'day' && (
            <ChevronDownOutlineIcon
              className={cn(
                'shrink-0 text-[var(--muted)] transition-transform duration-150',
                open && 'rotate-180',
                bigChevron ? 'size-6' : 'size-5',
              )}
            />
          )}
        </button>
      ) : (
        /* Plain label — carousel-style, no dropdown */
        <h2 className={cn('w-44 text-center text-[22px] font-bold tracking-tight text-[var(--text)]', labelClassName)}>
          {displayLabel}
        </h2>
      )}

      {(dateMode === 'month' || dateMode === 'day') && (
        <IconButton
          label={dateMode === 'day' ? 'Next day' : 'Next month'}
          icon={<ChevronRightOutlineIcon />}
          onClick={() =>
            dateMode === 'day' ? onChange({ day: shiftDayStr(month, 1) }) : onChange({ month: shiftMonthStr(month, 1) })
          }
          disabled={maxMonth !== undefined && month >= maxMonth}
          className="bg-transparent text-[var(--muted)] hover:bg-transparent hover:text-[var(--text)] disabled:opacity-30"
        />
      )}

      {currentMonth !== undefined && month !== currentMonth && (dateMode === 'month' || dateMode === 'day') && (
        <Button
          variant="fin-pill"
          size="xs"
          onClick={() => onChange(dateMode === 'day' ? { day: currentMonth } : { month: currentMonth })}
        >
          Today
        </Button>
      )}

      {dateMode === 'day' && open && (
        <div className="absolute left-1/2 top-full z-30 mt-2 -translate-x-1/2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-xl">
          <Input
            type="date"
            value={month}
            max={maxMonth}
            onChange={e => {
              if (e.target.value) {
                onChange({ day: e.target.value });
                setOpen(false);
              }
            }}
            variant="ghost"
            className="text-[13px] text-[var(--text)]"
            autoFocus
          />
        </div>
      )}

      {extendedFilters && open && (
        <div className="absolute left-0 top-full z-30 mt-2 min-w-[252px] rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl">
          <div className="flex gap-1 border-b border-[var(--border)] p-2">
            <Button variant="fin-pill" size="xs" active={tab === 'month'} onClick={() => setTab('month')}>
              Month
            </Button>
            <Button variant="fin-pill" size="xs" active={tab === 'range'} onClick={() => setTab('range')}>
              Date range
            </Button>
            <Button
              variant="fin-pill"
              size="xs"
              active={tab === 'all'}
              onClick={() => {
                onChange({ dateMode: 'all' });
                setOpen(false);
              }}
            >
              All time
            </Button>
          </div>

          {tab === 'month' && (
            <div className="p-3">
              <div className="mb-3 flex items-center justify-between">
                <IconButton
                  label="Previous year"
                  icon={<ChevronLeftOutlineIcon />}
                  onClick={() => setPickerYear(y => y - 1)}
                  className="bg-transparent text-[var(--muted)] hover:bg-transparent hover:text-[var(--text)]"
                />
                <span className="text-[13px] font-semibold text-[var(--text)]">{pickerYear}</span>
                <IconButton
                  label="Next year"
                  icon={<ChevronRightOutlineIcon />}
                  onClick={() => setPickerYear(y => y + 1)}
                  className="bg-transparent text-[var(--muted)] hover:bg-transparent hover:text-[var(--text)]"
                />
              </div>
              <div className="grid grid-cols-4 gap-1">
                {MONTH_NAMES.map((name, i) => {
                  const isSelected = dateMode === 'month' && pickerYear === selectedYear && i === selectedMonthIdx;
                  return (
                    <button
                      key={name}
                      onClick={() => selectMonth(i)}
                      className={cn(
                        'rounded-lg py-1.5 text-[12px] font-medium transition-colors',
                        isSelected ? 'bg-[var(--accent)] text-white' : 'text-[var(--text)] hover:bg-[var(--card2)]',
                      )}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'range' && (
            <div className="flex flex-col gap-2 p-3">
              <label className="block rounded-[10px] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5">
                <span className="mb-[3px] block text-[9px] uppercase tracking-[0.07em] text-[var(--subtle)]">From</span>
                <Input
                  type="date"
                  value={rangeFrom}
                  onChange={e => setRangeFrom(e.target.value)}
                  variant="ghost"
                  className="w-full text-[13px] text-[var(--text)]"
                />
              </label>
              <label className="block rounded-[10px] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5">
                <span className="mb-[3px] block text-[9px] uppercase tracking-[0.07em] text-[var(--subtle)]">To</span>
                <Input
                  type="date"
                  value={rangeTo}
                  onChange={e => setRangeTo(e.target.value)}
                  variant="ghost"
                  className="w-full text-[13px] text-[var(--text)]"
                />
              </label>
              <Button variant="fin-pill" size="xs" className="mt-1 self-end" onClick={applyRange}>
                Apply
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
