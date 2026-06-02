'use client';

import { useState } from 'react';
import { SectionCard } from '@/components/SectionCard';
import { BookingTypeIcon, Button, Input, Textarea } from '@/components';
import { PinIcon } from '@/components/icons';
import type { TripPlace, TripWithStatus } from '@my-hub/shared/types';
import type { TripBookingExtended, TripDay } from './types';
import { calendarDays, formatDayHeading, toUTCDateStr } from '@my-hub/shared/utils';
import { apiFetch } from '@/lib/utils';

function getPlaceMapUrl(place: TripPlace): string {
  const query =
    place.location ?? place.name ?? (place.lat != null && place.lng != null ? `${place.lat},${place.lng}` : '');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

type DayByDayProps = {
  trip: TripWithStatus;
  bookings: TripBookingExtended[];
  dayNotes: TripDay[];
  places: TripPlace[];
  canEdit: boolean;
  onChanged: () => void;
};

type DayCardProps = {
  dateStr: string;
  note: TripDay | undefined;
  bookings: TripBookingExtended[];
  dayPlaces: TripPlace[];
  canEdit: boolean;
  onSaved: (date: string, title: string, notes: string) => Promise<void>;
  onDeleted: (id: number) => Promise<void>;
};

function DayCard({ dateStr, note, bookings, dayPlaces, canEdit, onSaved, onDeleted }: DayCardProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note?.title ?? '');
  const [notes, setNotes] = useState(note?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const dayBookings = bookings.filter(b => b.startAt && toUTCDateStr(new Date(b.startAt)) === dateStr);

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
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => {
              setTitle(note?.title ?? '');
              setNotes(note?.notes ?? '');
              setEditing(true);
            }}
            className="px-0 text-zinc-500 hover:text-zinc-300 hover:bg-transparent"
          >
            {note ? 'Edit' : '+ Add notes'}
          </Button>
        )}
      </div>

      {/* Bookings on this day */}
      {dayBookings.length > 0 && (
        <ul className="space-y-1">
          {dayBookings.map(b => (
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
          <Input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Day title (optional)"
          />
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes for this day…"
            rows={3}
            className="resize-none"
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="xs"
              onClick={handleSave}
              disabled={saving}
              className="bg-sky-700 hover:bg-sky-600"
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" variant="secondary" size="xs" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
            {note && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleDelete}
                disabled={saving}
                className="ml-auto px-0 text-red-500 hover:text-red-400 hover:bg-transparent"
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      ) : note ? (
        <div className="space-y-1">
          {note.title && <p className="text-sm font-medium text-zinc-300">{note.title}</p>}
          {note.notes && <p className="text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed">{note.notes}</p>}
          {dayPlaces.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {dayPlaces.map(place => (
                <a
                  key={place.id}
                  href={getPlaceMapUrl(place)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={place.location ?? place.name}
                  className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-amber-700/60 bg-amber-950/30 py-0.5 px-2 text-xs text-amber-300 hover:bg-amber-900/40 hover:text-amber-200 transition-colors"
                >
                  <PinIcon />
                  <span className="max-w-[10rem] truncate">{place.name}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      ) : (
        dayBookings.length === 0 && <p className="text-xs italic text-zinc-600">No bookings or notes for this day.</p>
      )}
    </div>
  );
}

export function DayByDay({ trip, bookings, dayNotes, places, canEdit, onChanged }: DayByDayProps) {
  if (!trip.startAt || !trip.endAt) return null;

  const days = calendarDays(new Date(trip.startAt), new Date(trip.endAt));
  if (days.length === 0) return null;

  const noteByDate = new Map<string, TripDay>(dayNotes.map(n => [n.date, n]));
  const placesById = new Map<number, TripPlace>(places.map(p => [p.id, p]));

  async function handleSaved(tripId: number, date: string, title: string, notes: string) {
    await apiFetch(`/api/travel/trips/${tripId}/days`, {
      method: 'POST',
      body: { date, title: title || null, notes: notes || null },
    });
    onChanged();
  }

  async function handleDeleted(id: number) {
    await apiFetch(`/api/travel/days/${id}`, { method: 'DELETE' });
    onChanged();
  }

  return (
    <SectionCard title="Day by Day" className="bg-zinc-950/40 border-zinc-800/60">
      <div className="space-y-3">
        {days.map(dateStr => {
          const note = noteByDate.get(dateStr);
          const dayPlaces = (note?.placeIds ?? [])
            .map(id => placesById.get(id))
            .filter((p): p is TripPlace => p != null);
          return (
            <DayCard
              key={dateStr}
              dateStr={dateStr}
              note={note}
              bookings={bookings}
              dayPlaces={dayPlaces}
              canEdit={canEdit}
              onSaved={(date, title, notes) => handleSaved(trip.id, date, title, notes)}
              onDeleted={handleDeleted}
            />
          );
        })}
      </div>
    </SectionCard>
  );
}
