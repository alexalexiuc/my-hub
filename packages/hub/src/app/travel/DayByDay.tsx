'use client';

import { useState } from 'react';
import { Card } from '@/components';
import { TravelSectionHeader } from './ui';
import { BookingTypeIcon, Button, MarkdownView } from '@/components';
import { PinIcon } from '@/components/icons';
import type { TripPlace, TripWithStatus } from '@my-hub/shared/types';
import type { TripBookingExtended, TripDay } from './types';
import { calendarDays, formatDayHeading, toUTCDateStr } from '@my-hub/shared/utils';
import { apiFetch } from '@/lib/utils';
import { DayNoteModal } from './DayNoteModal';

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
  tripId: number;
  onChanged: () => void;
};

function DayCard({ dateStr, note, bookings, dayPlaces, canEdit, tripId, onChanged }: DayCardProps) {
  const [showModal, setShowModal] = useState(false);

  const dayBookings = bookings.filter(b => b.startAt && toUTCDateStr(new Date(b.startAt)) === dateStr);

  async function handleSave(title: string, notes: string) {
    await apiFetch(`/api/travel/trips/${tripId}/days`, {
      method: 'POST',
      body: { date: dateStr, title: title || null, notes: notes || null },
    });
    onChanged();
  }

  async function handleDelete() {
    if (!note) return;
    await apiFetch(`/api/travel/days/${note.id}`, { method: 'DELETE' });
    onChanged();
  }

  return (
    <>
      {showModal && (
        <DayNoteModal
          dateStr={dateStr}
          existingNote={note}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          onDelete={note ? handleDelete : undefined}
        />
      )}

      <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--text)]">{formatDayHeading(dateStr)}</h3>
          {canEdit && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setShowModal(true)}
              className="px-0 text-[var(--muted)] hover:bg-transparent hover:text-[var(--text)]"
            >
              {note ? 'Edit' : '+ Add notes'}
            </Button>
          )}
        </div>

        {dayBookings.length > 0 && (
          <ul className="space-y-1">
            {dayBookings.map(b => (
              <li key={b.id} className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <span className="shrink-0 text-[var(--subtle)]">
                  <BookingTypeIcon type={b.bookingType} />
                </span>
                <span className="truncate">{b.title}</span>
                {b.provider && <span className="shrink-0 text-[var(--subtle)]">· {b.provider}</span>}
              </li>
            ))}
          </ul>
        )}

        {note ? (
          <div className="space-y-1">
            {note.title && <p className="text-sm font-medium text-[var(--text)]">{note.title}</p>}
            {note.notes && <MarkdownView value={note.notes} className="text-xs leading-relaxed text-[var(--muted)]" />}
            {dayPlaces.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {dayPlaces.map(place => (
                  <a
                    key={place.id}
                    href={getPlaceMapUrl(place)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={place.location ?? place.name}
                    className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-[var(--amber)]/60 bg-[var(--amber-d)] px-2 py-0.5 text-xs text-[var(--amber)] transition-colors hover:opacity-80"
                  >
                    <PinIcon />
                    <span className="max-w-[10rem] truncate">{place.name}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        ) : (
          dayBookings.length === 0 && (
            <p className="text-xs italic text-[var(--subtle)]">No bookings or notes for this day.</p>
          )
        )}
      </div>
    </>
  );
}

export function DayByDay({ trip, bookings, dayNotes, places, canEdit, onChanged }: DayByDayProps) {
  if (!trip.startAt || !trip.endAt) return null;

  const days = calendarDays(new Date(trip.startAt), new Date(trip.endAt));
  if (days.length === 0) return null;

  const noteByDate = new Map<string, TripDay>(dayNotes.map(n => [n.date, n]));
  const placesById = new Map<number, TripPlace>(places.map(p => [p.id, p]));

  return (
    <Card className="!p-0 overflow-hidden">
      <TravelSectionHeader title="Day by Day" />
      <div className="space-y-3 p-4">
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
              tripId={trip.id}
              onChanged={onChanged}
            />
          );
        })}
      </div>
    </Card>
  );
}
