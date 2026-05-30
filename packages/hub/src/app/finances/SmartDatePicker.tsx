'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button, IconButton, Input } from '@/components';
import { ChevronLeftOutlineIcon, ChevronRightOutlineIcon, ChevronDownOutlineIcon } from '@/components/icons';
import { shiftMonthStr, formatMonthStr } from '@my-hub/shared/utils';
import { FinFieldCard } from './ui';

export type DateMode = 'month' | 'range' | 'all';

export type SmartDatePickerProps = {
  month: string;
  onChange: (patch: { dateMode?: DateMode; month?: string; fromDate?: string; toDate?: string }) => void;
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

export function SmartDatePicker({
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
}: SmartDatePickerProps) {
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
    dateMode === 'all' ? 'All time' : dateMode === 'range' ? formatDateRange(fromDate, toDate) : formatMonthStr(month);

  const bigChevron = !!labelClassName;

  return (
    <div ref={ref} className={cn('relative flex items-center gap-2', className)}>
      {dateMode === 'month' && (
        <IconButton
          label="Previous month"
          icon={<ChevronLeftOutlineIcon />}
          onClick={() => onChange({ month: shiftMonthStr(month, -1) })}
          className="bg-transparent text-[var(--fin-muted)] hover:bg-transparent hover:text-[var(--fin-text)]"
        />
      )}

      {extendedFilters ? (
        /* Clickable label with dropdown */
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1 rounded-lg px-1 py-0.5 transition-colors hover:bg-[var(--fin-card2)]"
        >
          <span
            className={cn('min-w-44 font-bold tracking-tight text-[var(--fin-text)]', labelClassName ?? 'text-[22px]')}
          >
            {displayLabel}
          </span>
          <ChevronDownOutlineIcon
            className={cn(
              'shrink-0 text-[var(--fin-muted)] transition-transform duration-150',
              open && 'rotate-180',
              bigChevron ? 'size-6' : 'size-5',
            )}
          />
        </button>
      ) : (
        /* Plain label — MonthCarousel-style, no dropdown */
        <h2
          className={cn('w-44 text-center text-[22px] font-bold tracking-tight text-[var(--fin-text)]', labelClassName)}
        >
          {displayLabel}
        </h2>
      )}

      {dateMode === 'month' && (
        <IconButton
          label="Next month"
          icon={<ChevronRightOutlineIcon />}
          onClick={() => onChange({ month: shiftMonthStr(month, 1) })}
          disabled={maxMonth !== undefined && month >= maxMonth}
          className="bg-transparent text-[var(--fin-muted)] hover:bg-transparent hover:text-[var(--fin-text)] disabled:opacity-30"
        />
      )}

      {currentMonth !== undefined && month !== currentMonth && dateMode === 'month' && (
        <Button variant="fin-pill" size="xs" onClick={() => onChange({ month: currentMonth })}>
          Today
        </Button>
      )}

      {extendedFilters && open && (
        <div className="absolute left-0 top-full z-30 mt-2 min-w-[252px] rounded-xl border border-[var(--fin-border)] bg-[var(--fin-card)] shadow-xl">
          <div className="flex gap-1 border-b border-[var(--fin-border)] p-2">
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
                  className="bg-transparent text-[var(--fin-muted)] hover:bg-transparent hover:text-[var(--fin-text)]"
                />
                <span className="text-[13px] font-semibold text-[var(--fin-text)]">{pickerYear}</span>
                <IconButton
                  label="Next year"
                  icon={<ChevronRightOutlineIcon />}
                  onClick={() => setPickerYear(y => y + 1)}
                  className="bg-transparent text-[var(--fin-muted)] hover:bg-transparent hover:text-[var(--fin-text)]"
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
                        isSelected
                          ? 'bg-[var(--fin-accent)] text-white'
                          : 'text-[var(--fin-text)] hover:bg-[var(--fin-card2)]',
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
              <FinFieldCard label="From">
                <Input
                  type="date"
                  value={rangeFrom}
                  onChange={e => setRangeFrom(e.target.value)}
                  variant="ghost"
                  className="w-full text-[13px] text-[var(--fin-text)]"
                />
              </FinFieldCard>
              <FinFieldCard label="To">
                <Input
                  type="date"
                  value={rangeTo}
                  onChange={e => setRangeTo(e.target.value)}
                  variant="ghost"
                  className="w-full text-[13px] text-[var(--fin-text)]"
                />
              </FinFieldCard>
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
