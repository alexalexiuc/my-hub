'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Trip, TripBooking } from '@my-hub/shared/types';

interface BookingsCalendarProps {
  trip: Trip;
  bookings: TripBooking[];
  tripColor?: string | null;
}

const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function withAlpha(hex: string, alpha: number): string {
  const valid = /^#([0-9a-fA-F]{6})$/.exec(hex);
  const raw = valid?.[1];
  if (!raw) return `rgba(59,130,246,${alpha})`;

  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function bookingDotClass(bookingType: string): string {
  switch (bookingType) {
    case 'flight':
      return 'bg-sky-400';
    case 'accommodation':
      return 'bg-emerald-400';
    case 'rental_car':
      return 'bg-amber-400';
    case 'train':
    case 'bus':
    case 'ferry':
    case 'taxi':
      return 'bg-indigo-400';
    default:
      return 'bg-zinc-400';
  }
}

function getMinBookingDate(bookings: TripBooking[], trip: Trip): Date {
  const dates = bookings
    .map((b) => toDate(b.startAt))
    .concat(toDate(trip.startAt || Date.now()))
    .filter((d): d is Date => d !== null);

  if (dates.length === 0) return new Date();
  return new Date(Math.min(...dates.map((d) => d.getTime())));
}

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
        <button
          onClick={() => moveMonth(-1)}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm hover:bg-zinc-800"
        >
          Prev
        </button>
        <p className="text-sm font-semibold text-zinc-200">{monthLabel}</p>
        <button
          onClick={() => moveMonth(1)}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm hover:bg-zinc-800"
        >
          Next
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs uppercase tracking-wide text-zinc-500">
        {dayNames.map((name) => (
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
