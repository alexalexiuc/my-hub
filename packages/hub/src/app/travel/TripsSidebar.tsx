'use client';

import { useMemo, useState } from 'react';
import { Button, IconButton, MultiButtonGroup, SectionCard } from '@/components';
import { PencilIcon, TrashIcon } from '@/components/icons';
import type { Trip } from '@my-hub/shared/types';
import type { ApiTrip, BookingRange } from './types';
import { toDateInputValue } from '@my-hub/shared/utils';
import { randomTripColor, formatShortDate } from './trips-sidebar.utils';

type TripsSidebarProps = {
  trips: ApiTrip[];
  activeTripId: number | null;
  onSelectTrip: (id: number) => void;
  tripBookingRanges: Record<number, BookingRange>;
  loadingTrips: boolean;
  onTripsChanged: () => void;
  onOverviewChanged: (tripId: number) => void;
};

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
  const [filterMode, setFilterMode] = useState<'upcoming' | 'all'>('upcoming');

  const filteredTrips = useMemo(() => {
    const base =
      filterMode === 'upcoming' ? trips.filter((t) => t.status !== 'cancelled' && t.status !== 'completed') : trips;
    return [...base].sort((a, b) => {
      const aDate = a.startAt ? new Date(a.startAt).getTime() : null;
      const bDate = b.startAt ? new Date(b.startAt).getTime() : null;
      if (aDate === null && bDate === null) return 0;
      if (aDate === null) return 1;
      if (bDate === null) return -1;
      return bDate - aDate;
    });
  }, [trips, filterMode]);

  async function createTrip() {
    if (!newTripName.trim()) return;
    const res = await fetch('/api/travel/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newTripName.trim(),
        color: newTripColor,
        destination: newTripDestination.trim() || null,
        start_at: newTripStartAt ? `${newTripStartAt}T00:00:00.000Z` : undefined,
        end_at: newTripEndAt ? `${newTripEndAt}T00:00:00.000Z` : undefined,
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
          <Button onClick={createTrip} className="w-full bg-emerald-600 hover:bg-emerald-500">
            Create Trip
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            {filteredTrips.length} trip{filteredTrips.length !== 1 ? 's' : ''}
          </span>
          <MultiButtonGroup
            options={[
              { label: 'Upcoming', value: 'upcoming' as const },
              { label: 'All', value: 'all' as const },
            ]}
            value={filterMode}
            onChange={setFilterMode}
            width="165px"
          />
        </div>

        <div className="max-h-[420px] overflow-auto space-y-2">
          {loadingTrips && <p className="text-sm text-zinc-500">Loading trips...</p>}
          {!loadingTrips && filteredTrips.length === 0 && (
            <p className="text-sm text-zinc-500">
              {filterMode === 'upcoming' ? 'No upcoming trips.' : 'No trips yet.'}
            </p>
          )}
          {filteredTrips.map((trip) => (
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
                      <Button
                        size="xs"
                        onClick={() => saveTripEdits(trip.id)}
                        className="bg-emerald-600 hover:bg-emerald-500"
                      >
                        Save
                      </Button>
                      <Button variant="secondary" size="xs" onClick={cancelEditTrip}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => onSelectTrip(trip.id)}
                      className="min-w-0 flex-1 text-left px-0 py-0 font-normal hover:bg-transparent"
                    >
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
                    </Button>
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
