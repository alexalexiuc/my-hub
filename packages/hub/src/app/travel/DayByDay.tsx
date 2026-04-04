'use client';

import { useState } from 'react';
import { SectionCard } from '@/components/SectionCard';
import { BookingTypeIcon } from '@/components';
import type { TripWithStatus } from '@my-hub/shared/types';
import type { TripBookingExtended, TripDay } from './types';
import { calendarDays, isoDate } from '@my-hub/shared/utils';

interface DayByDayProps {
  trip: TripWithStatus;
  bookings: TripBookingExtended[];
  dayNotes: TripDay[];
  canEdit: boolean;
  onChanged: () => void;
}

function formatDayHeading(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

interface DayCardProps {
  dateStr: string;
  note: TripDay | undefined;
  bookings: TripBookingExtended[];
  canEdit: boolean;
  onSaved: (date: string, title: string, notes: string) => Promise<void>;
  onDeleted: (id: number) => Promise<void>;
}

function DayCard({ dateStr, note, bookings, canEdit, onSaved, onDeleted }: DayCardProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note?.title ?? '');
  const [notes, setNotes] = useState(note?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const dayBookings = bookings.filter((b) => b.startAt && isoDate(new Date(b.startAt)) === dateStr);

  async function handleSave() {
    setSaving(true);
    try {
      await onSaved(dateStr, title, notes);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!note) return;
    setSaving(true);
    try {
      await onDeleted(note.id);
      setTitle('');
      setNotes('');
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-200">{formatDayHeading(dateStr)}</h3>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => {
              setTitle(note?.title ?? '');
              setNotes(note?.notes ?? '');
              setEditing(true);
            }}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {note ? 'Edit' : '+ Add notes'}
          </button>
        )}
      </div>

      {/* Bookings on this day */}
      {dayBookings.length > 0 && (
        <ul className="space-y-1">
          {dayBookings.map((b) => (
            <li key={b.id} className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="text-zinc-500 shrink-0">
                <BookingTypeIcon type={b.bookingType} />
              </span>
              <span className="truncate">{b.title}</span>
              {b.provider && <span className="text-zinc-600 shrink-0">· {b.provider}</span>}
            </li>
          ))}
        </ul>
      )}

      {/* Notes display or edit */}
      {editing ? (
        <div className="space-y-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Day title (optional)"
            className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes for this day…"
            rows={3}
            className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded bg-sky-700 px-3 py-1 text-xs font-medium text-white hover:bg-sky-600 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
            >
              Cancel
            </button>
            {note && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="ml-auto text-xs text-red-500 hover:text-red-400 disabled:opacity-50"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      ) : note ? (
        <div className="space-y-1">
          {note.title && <p className="text-sm font-medium text-zinc-300">{note.title}</p>}
          {note.notes && <p className="text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed">{note.notes}</p>}
        </div>
      ) : (
        dayBookings.length === 0 && <p className="text-xs italic text-zinc-600">No bookings or notes for this day.</p>
      )}
    </div>
  );
}

export function DayByDay({ trip, bookings, dayNotes, canEdit, onChanged }: DayByDayProps) {
  if (!trip.startAt || !trip.endAt) return null;

  const days = calendarDays(new Date(trip.startAt), new Date(trip.endAt));
  if (days.length === 0) return null;

  const noteByDate = new Map<string, TripDay>(dayNotes.map((n) => [n.date, n]));

  async function handleSaved(tripId: number, date: string, title: string, notes: string) {
    await fetch(`/api/travel/trips/${tripId}/days`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, title: title || null, notes: notes || null }),
    });
    onChanged();
  }

  async function handleDeleted(id: number) {
    await fetch(`/api/travel/days/${id}`, { method: 'DELETE' });
    onChanged();
  }

  return (
    <SectionCard title="Day by Day" className="bg-zinc-950/40 border-zinc-800/60">
      <div className="space-y-3">
        {days.map((dateStr) => (
          <DayCard
            key={dateStr}
            dateStr={dateStr}
            note={noteByDate.get(dateStr)}
            bookings={bookings}
            canEdit={canEdit}
            onSaved={(date, title, notes) => handleSaved(trip.id, date, title, notes)}
            onDeleted={handleDeleted}
          />
        ))}
      </div>
    </SectionCard>
  );
}
