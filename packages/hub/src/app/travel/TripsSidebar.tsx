'use client';

import { useState } from 'react';
import { SectionCard } from '@/components/SectionCard';
import type { Trip, TripStatus } from '@my-hub/shared/types';
import type { ApiTrip, BookingRange } from './types';
import { IconButton } from '@/components';
import { PencilIcon, TrashIcon } from '@/components/icons';

const tripColorPalette = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#84CC16'];

function randomTripColor(): string {
  return tripColorPalette[Math.floor(Math.random() * tripColorPalette.length)] ?? '#3B82F6';
}

const statusOptions: TripStatus[] = ['planned', 'active', 'completed', 'cancelled'];

function toDateInputValue(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const timezoneOffsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

function formatShortDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString();
}

interface TripsSidebarProps {
  trips: ApiTrip[];
  activeTripId: number | null;
  onSelectTrip: (id: number) => void;
  tripBookingRanges: Record<number, BookingRange>;
  loadingTrips: boolean;
  onTripsChanged: () => void;
  onOverviewChanged: (tripId: number) => void;
}

export function TripsSidebar({
  trips,
  activeTripId,
  onSelectTrip,
  tripBookingRanges,
  loadingTrips,
  onTripsChanged,
  onOverviewChanged,
}: TripsSidebarProps) {
  const [newTripName, setNewTripName] = useState('');
  const [newTripColor, setNewTripColor] = useState(() => randomTripColor());
  const [newTripDestination, setNewTripDestination] = useState('');
  const [newTripStartAt, setNewTripStartAt] = useState('');
  const [newTripEndAt, setNewTripEndAt] = useState('');
  const [editingTripId, setEditingTripId] = useState<number | null>(null);
  const [editTripName, setEditTripName] = useState('');
  const [editTripDestination, setEditTripDestination] = useState('');
  const [editTripColor, setEditTripColor] = useState('#3B82F6');
  const [editTripStartAt, setEditTripStartAt] = useState('');
  const [editTripEndAt, setEditTripEndAt] = useState('');

  async function createTrip() {
    if (!newTripName.trim()) return;
    const status = statusOptions[0];
    const res = await fetch('/api/travel/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newTripName.trim(),
        color: newTripColor,
        destination: newTripDestination.trim() || null,
        start_at: newTripStartAt ? `${newTripStartAt}T00:00:00.000Z` : undefined,
        end_at: newTripEndAt ? `${newTripEndAt}T00:00:00.000Z` : undefined,
        status,
      }),
    });
    if (!res.ok) return;
    setNewTripName('');
    setNewTripColor(randomTripColor());
    setNewTripDestination('');
    setNewTripStartAt('');
    setNewTripEndAt('');
    onTripsChanged();
  }

  function startEditTrip(trip: Trip) {
    setEditingTripId(trip.id);
    setEditTripName(trip.name);
    setEditTripDestination(trip.destination ?? '');
    setEditTripColor(trip.color);
    setEditTripStartAt(toDateInputValue(trip.startAt));
    setEditTripEndAt(toDateInputValue(trip.endAt));
  }

  function cancelEditTrip() {
    setEditingTripId(null);
    setEditTripName('');
    setEditTripDestination('');
    setEditTripColor('#3B82F6');
    setEditTripStartAt('');
    setEditTripEndAt('');
  }

  async function saveTripEdits(tripId: number) {
    const trimmedName = editTripName.trim();
    if (!trimmedName) return;
    await fetch(`/api/travel/trips/${tripId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: trimmedName,
        destination: editTripDestination.trim() || null,
        color: editTripColor,
        start_at: editTripStartAt ? `${editTripStartAt}T00:00:00.000Z` : null,
        end_at: editTripEndAt ? `${editTripEndAt}T00:00:00.000Z` : null,
      }),
    });
    cancelEditTrip();
    onTripsChanged();
    if (activeTripId === tripId) onOverviewChanged(tripId);
  }

  async function removeTrip(tripId: number) {
    await fetch(`/api/travel/trips/${tripId}`, { method: 'DELETE' });
    onTripsChanged();
  }

  return (
    <SectionCard title="Trips" className="bg-emerald-950/20 border-emerald-800/50">
      <div className="space-y-3">
        <div className="space-y-2">
          <input
            value={newTripName}
            onChange={(e) => setNewTripName(e.target.value)}
            placeholder="Trip name"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          />
          <input
            value={newTripDestination}
            onChange={(e) => setNewTripDestination(e.target.value)}
            placeholder="Destination"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={newTripStartAt}
              onChange={(e) => setNewTripStartAt(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={newTripEndAt}
              onChange={(e) => setNewTripEndAt(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">
            <label htmlFor="trip-color" className="text-zinc-300">
              Color
            </label>
            <input
              id="trip-color"
              type="color"
              value={newTripColor}
              onChange={(e) => setNewTripColor(e.target.value)}
              className="h-8 w-8 cursor-pointer rounded-full border-none bg-transparent p-0"
            />
          </div>
          <button
            onClick={createTrip}
            className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Create Trip
          </button>
        </div>

        <div className="max-h-[420px] overflow-auto space-y-2">
          {loadingTrips && <p className="text-sm text-zinc-500">Loading trips...</p>}
          {!loadingTrips && trips.length === 0 && <p className="text-sm text-zinc-500">No trips yet.</p>}
          {trips.map((trip) => (
            <div
              key={trip.id}
              className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                activeTripId === trip.id ? 'bg-emerald-500/10' : 'bg-zinc-900 hover:border-zinc-500'
              }`}
              style={{ borderColor: activeTripId === trip.id ? trip.color : undefined, borderLeftWidth: '4px' }}
            >
              {editingTripId === trip.id ? (
                <div className="space-y-2">
                  <input
                    value={editTripName}
                    onChange={(e) => setEditTripName(e.target.value)}
                    placeholder="Trip name"
                    className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                  />
                  <input
                    value={editTripDestination}
                    onChange={(e) => setEditTripDestination(e.target.value)}
                    placeholder="Destination"
                    className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={editTripStartAt}
                      onChange={(e) => setEditTripStartAt(e.target.value)}
                      className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                    />
                    <input
                      type="date"
                      value={editTripEndAt}
                      onChange={(e) => setEditTripEndAt(e.target.value)}
                      className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <input
                      type="color"
                      value={editTripColor}
                      onChange={(e) => setEditTripColor(e.target.value)}
                      className="h-8 w-8 cursor-pointer rounded-full border-none bg-transparent p-0"
                      aria-label="Trip color"
                      title="Trip color"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => saveTripEdits(trip.id)}
                        className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEditTrip}
                        className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <button onClick={() => onSelectTrip(trip.id)} className="min-w-0 flex-1 text-left">
                      <p className="font-medium flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: trip.color }}
                        />
                        {trip.name}
                      </p>
                      <p className="text-xs text-zinc-400">{trip.destination ?? 'No destination set'}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Owner: {trip.access_role === 'owner' ? 'You' : (trip.owner_name ?? trip.owner_email)}
                      </p>
                    </button>
                    {trip.can_edit && (
                      <div className="flex items-center gap-1">
                        <IconButton label="Edit trip" onClick={() => startEditTrip(trip)} icon={<PencilIcon />} />
                        <IconButton label="Remove trip" onClick={() => removeTrip(trip.id)} icon={<TrashIcon />} />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    {(() => {
                      const from = formatShortDate(
                        tripBookingRanges[trip.id]?.fromAt ?? (trip.startAt as string | null),
                      );
                      const to = formatShortDate(tripBookingRanges[trip.id]?.toAt ?? (trip.endAt as string | null));
                      if (!from && !to) return 'Reservation dates not set';
                      if (from && to && from !== to) return `${from} -> ${to}`;
                      return from ?? to ?? 'Reservation dates not set';
                    })()}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}
