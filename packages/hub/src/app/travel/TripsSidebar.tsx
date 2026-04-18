'use client';

import { useMemo, useState } from 'react';
import { Button, IconButton, MultiButtonGroup, SectionCard } from '@/components';
import { PencilIcon, PlusOutlineIcon, TrashIcon } from '@/components/icons';
import { apiFetch } from '@/lib/utils';
import type { Trip } from '@my-hub/shared/types';
import type { ApiTrip, BookingRange } from './types';
import { TripForm } from './TripForm';
import { tripToFormValues, formToCreateBody, formToUpdateBody, type TripFormValues } from './trip-form.schema';
import { formatShortDate, formatTripDateRange } from './trips-sidebar.utils';

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
  const [editingTripId, setEditingTripId] = useState<number | null>(null);
  const [showingCreateForm, setShowingCreateForm] = useState(false);
  const [filterMode, setFilterMode] = useState<'upcoming' | 'all'>('upcoming');

  const filteredTrips = useMemo(() => {
    const now = Date.now();
    const base =
      filterMode === 'upcoming' ? trips.filter(t => t.status !== 'cancelled' && t.status !== 'completed') : trips;

    const upcoming: ApiTrip[] = [];
    const past: ApiTrip[] = [];
    const noDate: ApiTrip[] = [];

    for (const trip of base) {
      if (!trip.startAt) {
        noDate.push(trip);
      } else {
        const t = new Date(trip.startAt as unknown as string).getTime();
        if (t >= now) upcoming.push(trip);
        else past.push(trip);
      }
    }

    upcoming.sort(
      (a, b) => new Date(a.startAt as unknown as string).getTime() - new Date(b.startAt as unknown as string).getTime(),
    );
    past.sort(
      (a, b) => new Date(b.startAt as unknown as string).getTime() - new Date(a.startAt as unknown as string).getTime(),
    );

    return [...upcoming, ...past, ...noDate];
  }, [trips, filterMode]);

  async function createTrip(values: TripFormValues) {
    await apiFetch('/api/travel/trips', { method: 'POST', body: formToCreateBody(values) });
    setShowingCreateForm(false);
    onTripsChanged();
  }

  async function saveTripEdits(tripId: number, values: TripFormValues) {
    await apiFetch(`/api/travel/trips/${tripId}`, { method: 'PATCH', body: formToUpdateBody(values) });
    setEditingTripId(null);
    onTripsChanged();
    if (activeTripId === tripId) onOverviewChanged(tripId);
  }

  async function removeTrip(tripId: number) {
    await apiFetch(`/api/travel/trips/${tripId}`, { method: 'DELETE' });
    onTripsChanged();
  }

  return (
    <SectionCard title="Trips" className="bg-emerald-950/20 border-emerald-800/50">
      <div className="space-y-3">
        {showingCreateForm ? (
          <TripForm
            onSubmit={createTrip}
            onCancel={() => setShowingCreateForm(false)}
            submitLabel="Create Trip"
            submitClassName="bg-emerald-600 hover:bg-emerald-500"
          />
        ) : (
          <Button variant="secondary" className="w-full" onClick={() => setShowingCreateForm(true)}>
            <PlusOutlineIcon /> New Trip
          </Button>
        )}

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
          {filteredTrips.map(trip => (
            <div
              key={trip.id}
              className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                activeTripId === trip.id ? 'bg-emerald-500/10' : 'bg-zinc-900 hover:border-zinc-500'
              }`}
              style={{ borderColor: activeTripId === trip.id ? trip.color : undefined, borderLeftWidth: '4px' }}
            >
              {editingTripId === trip.id ? (
                <TripForm
                  defaultValues={tripToFormValues(trip as unknown as Trip)}
                  onSubmit={values => saveTripEdits(trip.id, values)}
                  onCancel={() => setEditingTripId(null)}
                  submitLabel="Save"
                  submitClassName="bg-emerald-600 hover:bg-emerald-500"
                />
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
                        Owner: {trip.accessRole === 'owner' ? 'You' : (trip.ownerName ?? trip.ownerEmail)}
                      </p>
                    </Button>
                    {trip.canEdit && (
                      <div className="flex items-center gap-1">
                        <IconButton label="Edit trip" onClick={() => setEditingTripId(trip.id)} icon={<PencilIcon />} />
                        <IconButton label="Remove trip" onClick={() => removeTrip(trip.id)} icon={<TrashIcon />} />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    {formatTripDateRange(
                      formatShortDate(tripBookingRanges[trip.id]?.fromAt ?? (trip.startAt as string | null)),
                      formatShortDate(tripBookingRanges[trip.id]?.toAt ?? (trip.endAt as string | null)),
                    )}
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
