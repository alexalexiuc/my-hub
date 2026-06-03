'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { ConfirmModal } from '@/components';
import { PencilIcon, TrashIcon } from '@/components/icons';
import type { ApiTrip, BookingRange } from './types';
import { travelEvents } from './travelEvents';
import { TripModal } from './TripModal';
import { formatShortDate, formatTripDateRange } from './trips-sidebar.utils';

export const ACTIVE_TRIP_KEY = 'travel:activeTripId';

export function readActiveTripId(): number | null {
  try {
    const v = localStorage.getItem(ACTIVE_TRIP_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

function writeActiveTripId(id: number | null): void {
  try {
    if (id != null) localStorage.setItem(ACTIVE_TRIP_KEY, String(id));
    else localStorage.removeItem(ACTIVE_TRIP_KEY);
  } catch {}
}

export function TripSwitcher() {
  const [trips, setTrips] = useState<ApiTrip[]>([]);
  const [activeTripId, setActiveTripId] = useState<number | null>(null);
  const [bookingRanges, setBookingRanges] = useState<Record<number, BookingRange>>({});
  const [open, setOpen] = useState(false);
  const [showTripModal, setShowTripModal] = useState(false);
  const [editingTrip, setEditingTrip] = useState<ApiTrip | null>(null);
  const [deletingTrip, setDeletingTrip] = useState<ApiTrip | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadTrips = useCallback(async () => {
    try {
      const data = await apiFetch<{ trips: ApiTrip[]; bookingRanges?: BookingRange[] }>('/api/travel/trips');
      const tripsData = data.trips;
      const ranges = Object.fromEntries((data.bookingRanges ?? []).map(r => [r.tripId, r])) as Record<
        number,
        BookingRange
      >;

      setTrips(tripsData);
      setBookingRanges(ranges);

      const currentId = readActiveTripId();
      const isValid = currentId != null && tripsData.some(t => t.id === currentId);

      if (isValid) {
        setActiveTripId(currentId);
        return;
      }

      if (tripsData.length === 0) {
        writeActiveTripId(null);
        setActiveTripId(null);
        return;
      }

      const now = Date.now();
      const upcoming = tripsData
        .filter(t => t.startAt && new Date(t.startAt as unknown as string).getTime() >= now)
        .sort(
          (a, b) =>
            new Date(a.startAt as unknown as string).getTime() - new Date(b.startAt as unknown as string).getTime(),
        );
      const nextId = (upcoming[0] ?? tripsData[0])!.id;

      writeActiveTripId(nextId);
      setActiveTripId(nextId);
      // Notify pages of the newly selected trip
      travelEvents.emit('changed');
    } catch {}
  }, []);

  useEffect(() => {
    loadTrips();
    travelEvents.on('changed', loadTrips);
    return () => travelEvents.off('changed', loadTrips);
  }, [loadTrips]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (!dropdownRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  function selectTrip(id: number) {
    writeActiveTripId(id);
    setActiveTripId(id);
    travelEvents.emit('changed');
    setOpen(false);
  }

  async function handleDeleteTrip() {
    if (!deletingTrip) return;
    await apiFetch(`/api/travel/trips/${deletingTrip.id}`, { method: 'DELETE' });
    setDeletingTrip(null);
    travelEvents.emit('changed');
  }

  const activeTrip = trips.find(t => t.id === activeTripId);

  function tripDateLabel(trip: ApiTrip): string {
    const range = bookingRanges[trip.id];
    return formatTripDateRange(
      formatShortDate(range?.fromAt ?? (trip.startAt as string | null)),
      formatShortDate(range?.toAt ?? (trip.endAt as string | null)),
    );
  }

  return (
    <>
      {showTripModal && (
        <TripModal
          editingTrip={editingTrip ?? undefined}
          onClose={() => {
            setShowTripModal(false);
            setEditingTrip(null);
          }}
          onSaved={newId => {
            setShowTripModal(false);
            setEditingTrip(null);
            if (newId) {
              writeActiveTripId(newId);
              setActiveTripId(newId);
            }
            travelEvents.emit('changed');
          }}
        />
      )}
      {deletingTrip && (
        <ConfirmModal
          title="Delete Trip"
          message={`Delete "${deletingTrip.name}"? All bookings and data will be permanently removed.`}
          confirmLabel="Delete"
          onConfirm={handleDeleteTrip}
          onCancel={() => setDeletingTrip(null)}
        />
      )}

      <div ref={dropdownRef} className="relative mb-5">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm transition-colors hover:border-[var(--accent)]/50"
        >
          {activeTrip ? (
            <>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: activeTrip.color }} />
              <span className="font-medium text-[var(--text)]">{activeTrip.name}</span>
              <span className="text-xs text-[var(--muted)]">{tripDateLabel(activeTrip)}</span>
            </>
          ) : (
            <span className="text-[var(--muted)]">Select a trip</span>
          )}
          <span className="ml-1 text-xs text-[var(--muted)]">{open ? '▲' : '▼'}</span>
        </button>

        {open && (
          <div className="absolute left-0 top-full z-50 mt-1 w-80 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-xl">
            <div className="max-h-64 space-y-0.5 overflow-y-auto p-1.5">
              {trips.map(trip => (
                <div
                  key={trip.id}
                  className={cn(
                    'group flex items-center gap-2 rounded-md px-2.5 py-2 text-sm',
                    trip.id === activeTripId ? 'bg-[var(--card2)]' : 'hover:bg-[var(--card2)]',
                  )}
                >
                  <button
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => selectTrip(trip.id)}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: trip.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-[var(--text)]">{trip.name}</span>
                      <span className="block truncate text-xs text-[var(--muted)]">{tripDateLabel(trip)}</span>
                    </span>
                  </button>
                  {trip.canEdit && (
                    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        className="rounded p-1 text-[var(--muted)] hover:bg-[var(--card3)] hover:text-[var(--text)]"
                        onClick={e => {
                          e.stopPropagation();
                          setEditingTrip(trip);
                          setShowTripModal(true);
                          setOpen(false);
                        }}
                        title="Edit trip"
                      >
                        <PencilIcon className="size-3.5" />
                      </button>
                      <button
                        className="rounded p-1 text-[var(--muted)] hover:bg-[var(--card3)] hover:text-[var(--red)]"
                        onClick={e => {
                          e.stopPropagation();
                          setDeletingTrip(trip);
                          setOpen(false);
                        }}
                        title="Delete trip"
                      >
                        <TrashIcon className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {trips.length === 0 && <p className="px-2.5 py-2 text-sm text-[var(--muted)]">No trips yet.</p>}
            </div>
            <div className="border-t border-[var(--border)] p-1.5">
              <button
                className="w-full rounded-md px-2.5 py-2 text-left text-sm text-[var(--accent)] transition-colors hover:bg-[var(--card2)]"
                onClick={() => {
                  setEditingTrip(null);
                  setShowTripModal(true);
                  setOpen(false);
                }}
              >
                + New Trip
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
