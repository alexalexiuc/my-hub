'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Trip, TripBooking } from '@my-hub/shared/types';
import { getMonthStart, getMonthEnd, startOfWeekMonday, isSameDay, toDate, startOfDay } from '@my-hub/shared/utils';
import { Button } from '@/components';
import { withAlpha, bookingDotClass, getMinBookingDate } from './bookings-calendar.utils';
import { dayNamesShort } from '@my-hub/shared/constants';

type BookingsCalendarProps = {
  trip: Trip;
  bookings: TripBooking[];
  tripColor?: string | null;
};

export function BookingsCalendar({ bookings, tripColor, trip }: BookingsCalendarProps) {
  const [monthCursor, setMonthCursor] = useState(() => getMonthStart(getMinBookingDate(bookings, trip)));

  useEffect(() => {
    const next = getMonthStart(getMinBookingDate(bookings, trip));
    if (isSameDay(monthCursor, next)) return;
    setMonthCursor(next);
  }, [bookings, trip.startAt]);

  const { days, monthLabel } = useMemo(() => {
    const monthStart = getMonthStart(monthCursor);
    const monthEnd = getMonthEnd(monthCursor);
    const gridStart = startOfWeekMonday(monthStart);
    const gridEnd = startOfWeekMonday(new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate() + 6));

    const allDays: Date[] = [];
    const cursor = new Date(gridStart);
    while (cursor <= gridEnd) {
      allDays.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return {
      days: allDays,
      monthLabel: monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    };
  }, [monthCursor]);

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, TripBooking[]>();

    for (const booking of bookings) {
      const startAt = toDate(booking.startAt);
      if (!startAt) continue;

      const endAtRaw = toDate(booking.endAt);
      const rangeStart = startOfDay(startAt);
      const rangeEnd = startOfDay(endAtRaw && endAtRaw >= startAt ? endAtRaw : startAt);

      const cursor = new Date(rangeStart);
      while (cursor <= rangeEnd) {
        const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
        const current = map.get(key) ?? [];
        current.push(booking);
        map.set(key, current);
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    return map;
  }, [bookings]);

  function keyForDay(day: Date): string {
    return `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
  }

  function moveMonth(delta: number) {
    setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  const today = new Date();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" size="xs" onClick={() => moveMonth(-1)}>
          Prev
        </Button>
        <p className="text-sm font-semibold text-zinc-200">{monthLabel}</p>
        <Button variant="secondary" size="xs" onClick={() => moveMonth(1)}>
          Next
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs uppercase tracking-wide text-zinc-500">
        {dayNamesShort.map((name) => (
          <div key={name} className="py-1">
            {name}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const inMonth = day.getMonth() === monthCursor.getMonth();
          const dayBookings = bookingsByDay.get(keyForDay(day)) ?? [];
          const hasBookings = dayBookings.length > 0;
          const isToday = isSameDay(day, today);

          const dayStyle =
            hasBookings && tripColor
              ? {
                  borderColor: withAlpha(tripColor, isToday ? 0.95 : 0.7),
                  backgroundColor: inMonth ? withAlpha(tripColor, 0.12) : withAlpha(tripColor, 0.06),
                }
              : undefined;

          return (
            <div
              key={day.toISOString()}
              className={`min-h-24 rounded-md border p-1.5 ${
                inMonth ? 'border-zinc-700 bg-zinc-900' : 'border-zinc-800 bg-zinc-950 text-zinc-600'
              } ${isToday ? 'ring-1 ring-emerald-500/60' : ''}`}
              style={dayStyle}
            >
              <p className="mb-1 text-xs font-medium">{day.getDate()}</p>
              <div className="space-y-1">
                {dayBookings.slice(0, 3).map((booking) => (
                  <div
                    key={booking.id}
                    className="flex items-center gap-1 rounded bg-zinc-800/80 px-1 py-0.5 text-[10px] leading-tight text-zinc-200"
                    title={`${booking.title}${booking.provider ? ` · ${booking.provider}` : ''}`}
                    style={tripColor ? { borderLeft: `2px solid ${tripColor}` } : undefined}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${tripColor ? '' : bookingDotClass(booking.bookingType)}`}
                      style={tripColor ? { backgroundColor: tripColor } : undefined}
                    />
                    <span className="truncate">{booking.title}</span>
                  </div>
                ))}
                {dayBookings.length > 3 && <p className="text-[10px] text-zinc-500">+{dayBookings.length - 3} more</p>}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-zinc-500">
        Calendar is built from booking date ranges (start-to-end) for flights, stays, rentals, and other reservations.
      </p>
    </div>
  );
}
