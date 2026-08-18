'use client';

import { cn } from '@/lib/utils';
import { intakeBarColor, macroCalorieSplit } from '../calories.utils';
import { MACRO_COLORS } from '../constants';
import { MenuStatusBadge } from './MenuStatusBadge';
import { MenuStatusIcon } from './MenuStatusIcon';
import { menuDayStatus } from './calendar.utils';
import type { CalendarDay } from './types';
import type { MonthGridDay } from './calendar.utils';

type DayCellProps = {
  day: MonthGridDay;
  summary?: CalendarDay;
  isToday: boolean;
  isPast: boolean;
  onSelect: (date: string) => void;
};

/**
 * One month-grid cell: the day number and, once meals are logged, the kcal total tinted by the
 * same red/amber/green adherence rule the weekly menu and progress bars use — a day reads the
 * same way whichever tab it's judged from.
 *
 * Desktop and mobile render genuinely different layouts rather than the same content resized: a
 * square desktop cell only has room for a thin macro bar and a small corner badge, while a taller
 * mobile cell has room for a per-macro percentage line each and a bigger status icon.
 */
export function DayCell({ day, summary, isToday, isPast, onSelect }: DayCellProps) {
  const kcal = summary?.kcal ?? 0;
  const hasData = (summary?.mealCount ?? 0) > 0;
  const color = intakeBarColor(kcal, summary?.min ?? null, summary?.target ?? null);
  const dayNum = Number(day.date.slice(-2));
  const {
    proteinCal,
    carbsCal,
    fatCal,
    total: macroTotal,
  } = macroCalorieSplit(summary?.protein ?? 0, summary?.carbs ?? 0, summary?.fat ?? 0);
  const status = menuDayStatus(summary?.hasMenu ?? false, summary?.menuLogged ?? false, isPast, isToday);
  const macroPct = (cal: number) => (macroTotal > 0 ? Math.round((cal / macroTotal) * 100) : 0);

  const cellStyle =
    day.inMonth && hasData
      ? { backgroundColor: `color-mix(in srgb, ${color} 16%, var(--card2))`, borderColor: color }
      : undefined;

  const baseClasses = cn(
    'relative flex flex-col items-center rounded-lg border text-center transition-colors',
    day.inMonth ? 'border-[var(--border)] bg-[var(--card2)]' : 'border-transparent bg-transparent opacity-40',
    isToday && 'border-[var(--accent)]',
    'hover:border-[var(--accent)]/60',
  );

  const dayNumLabel = (
    <span className={cn('text-[10px]', day.inMonth ? 'text-[var(--muted)]' : 'text-[var(--subtle)]')}>{dayNum}</span>
  );

  return (
    <>
      {/* Desktop: compact square cell — day number, kcal, thin macro bar, corner menu badge. */}
      <button
        type="button"
        data-layout="desktop"
        onClick={() => onSelect(day.date)}
        className={cn(baseClasses, 'hidden aspect-square justify-center gap-0.5 md:flex')}
        style={cellStyle}
      >
        {day.inMonth && <MenuStatusBadge status={status} />}
        {dayNumLabel}
        {day.inMonth && hasData && (
          <span className="text-[11px] font-semibold" style={{ color }}>
            {Math.round(kcal)}
          </span>
        )}
        {day.inMonth && hasData && macroTotal > 0 && (
          <div className="flex h-[3px] w-3/4 max-w-[28px] overflow-hidden rounded-full">
            <div style={{ width: `${(proteinCal / macroTotal) * 100}%`, backgroundColor: MACRO_COLORS.protein }} />
            <div style={{ width: `${(carbsCal / macroTotal) * 100}%`, backgroundColor: MACRO_COLORS.carbs }} />
            <div style={{ width: `${(fatCal / macroTotal) * 100}%`, backgroundColor: MACRO_COLORS.fat }} />
          </div>
        )}
      </button>

      {/* Mobile: taller cell with room for a per-macro percentage line each and a bigger status
          icon anchored to the bottom, instead of a tiny corner badge. */}
      <button
        type="button"
        data-layout="mobile"
        onClick={() => onSelect(day.date)}
        className={cn(baseClasses, 'flex aspect-[3/4] justify-between gap-0.5 py-1.5 md:hidden')}
        style={cellStyle}
      >
        {dayNumLabel}

        {day.inMonth && hasData && (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs font-semibold leading-none" style={{ color }}>
              {Math.round(kcal)}
            </span>
            {macroTotal > 0 && (
              <div className="flex flex-col items-center gap-px leading-none">
                <span className="text-[9px] font-medium" style={{ color: MACRO_COLORS.protein }}>
                  P {macroPct(proteinCal)}%
                </span>
                <span className="text-[9px] font-medium" style={{ color: MACRO_COLORS.carbs }}>
                  C {macroPct(carbsCal)}%
                </span>
                <span className="text-[9px] font-medium" style={{ color: MACRO_COLORS.fat }}>
                  F {macroPct(fatCal)}%
                </span>
              </div>
            )}
          </div>
        )}

        {day.inMonth && <MenuStatusIcon status={status} className="mt-auto" />}
      </button>
    </>
  );
}
