'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/SectionCard';
import type { TripDocument } from '@my-hub/shared/types';
import type { ApiTrip, BookingRange, TripOverviewResponse } from './types';
import { BookingsCalendar } from './BookingsCalendar';
import { BookingsSection } from './BookingsSection';
import { ChecklistSection } from './ChecklistSection';
import { DocumentsSection } from './DocumentsSection';
import { CompanionsSection } from './CompanionsSection';
import { SharingSection } from './SharingSection';
import { ComingNext } from './ComingNext';
import { DayByDay } from './DayByDay';
import { TripMap } from './TripMap';
import { TripOverviewCards } from './TripOverviewCards';
import { TripsSidebar } from './TripsSidebar';
import { TravelOverviewSkeleton } from './TravelOverviewSkeleton';

const ACTIVE_TRIP_KEY = 'travel:activeTripId';

export default function TravelPage() {
  const [trips, setTrips] = useState<ApiTrip[]>([]);
  const [activeTripId, setActiveTripId] = useState<number | null>(null);
  const activeTripIdRef = useRef<number | null>(null);
  const [overview, setOverview] = useState<TripOverviewResponse | null>(null);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [tripBookingRanges, setTripBookingRanges] = useState<Record<number, BookingRange>>({});

  const activeTrip = useMemo(() => trips.find(trip => trip.id === activeTripId) ?? null, [trips, activeTripId]);
  const canEditActiveTrip = activeTrip?.canEdit ?? false;

  const documentsByBookingId = useMemo(() => {
    const groups = new Map<number, TripDocument[]>();
    if (!overview) return groups;
    for (const document of overview.documents) {
      if (!document.bookingId) continue;
      const current = groups.get(document.bookingId) ?? [];
      current.push(document);
      groups.set(document.bookingId, current);
    }
    return groups;
  }, [overview]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(ACTIVE_TRIP_KEY);
      if (stored) {
        const parsed = Number(stored);
        setActiveTripId(parsed);
        activeTripIdRef.current = parsed;
      }
    } catch {}
  }, []);

  useEffect(() => {
    activeTripIdRef.current = activeTripId;
  }, [activeTripId]);

  useEffect(() => {
    try {
      if (activeTripId != null) localStorage.setItem(ACTIVE_TRIP_KEY, String(activeTripId));
      else localStorage.removeItem(ACTIVE_TRIP_KEY);
    } catch {}
  }, [activeTripId]);

  const loadOverview = useCallback(async (tripId: number) => {
    setLoadingOverview(true);
    try {
      const data = await apiFetch<TripOverviewResponse>(`/api/travel/trips/${tripId}/overview`);
      setOverview(data);
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  const selectTrip = useCallback(
    async (tripId: number | null) => {
      setActiveTripId(tripId);
      activeTripIdRef.current = tripId;
      if (!tripId) {
        setOverview(null);
        return;
      }
      await loadOverview(tripId);
    },
    [loadOverview],
  );

  const loadTrips = useCallback(async () => {
    setLoadingTrips(true);
    try {
      const data = await apiFetch<{ trips: ApiTrip[]; bookingRanges?: BookingRange[] }>('/api/travel/trips');
      setTrips(data.trips);
      setTripBookingRanges(
        Object.fromEntries((data.bookingRanges ?? []).map(range => [range.tripId, range])) as Record<
          number,
          BookingRange
        >,
      );

      const currentTripId = activeTripIdRef.current;
      if (data.trips.length === 0) {
        await selectTrip(null);
      } else {
        let nextTripId = currentTripId;
        if (!currentTripId || !data.trips.some(trip => trip.id === currentTripId)) {
          const now = Date.now();
          const upcoming = data.trips
            .filter(t => t.startAt && new Date(t.startAt as unknown as string).getTime() >= now)
            .sort(
              (a, b) =>
                new Date(a.startAt as unknown as string).getTime() - new Date(b.startAt as unknown as string).getTime(),
            );
          nextTripId = (upcoming[0] ?? data.trips[0])!.id;
        }
        await selectTrip(nextTripId);
      }
    } finally {
      setLoadingTrips(false);
    }
  }, [selectTrip]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  function handleOverviewChanged() {
    if (activeTripId) loadOverview(activeTripId);
  }

  const showOverviewSkeleton = Boolean(activeTripId) && loadingOverview && !overview;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 space-y-6">
      <PageHeader title="My Travels" backHref="/" backLabel="← Home" />

      <section className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
        <TripsSidebar
          trips={trips}
          activeTripId={activeTripId}
          onSelectTrip={selectTrip}
          tripBookingRanges={tripBookingRanges}
          loadingTrips={loadingTrips}
          onTripsChanged={loadTrips}
          onOverviewChanged={loadOverview}
        />

        <div className="min-w-0 space-y-6">
          {!activeTripId ? (
            <div
              className={`flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/50 p-16 text-center ${loadingTrips ? 'animate-pulse' : ''}`}
            >
              {!loadingTrips && (
                <p className="text-zinc-500">No trips yet. Add your first trip using the form on the left.</p>
              )}
            </div>
          ) : showOverviewSkeleton ? (
            <TravelOverviewSkeleton />
          ) : (
            <>
              <ComingNext bookings={overview?.bookings ?? []} documents={overview?.documents ?? []} />

              {overview && <TripMap mapData={overview.mapData} tripId={activeTripId} />}

              <SectionCard title="Calendar" className="bg-cyan-950/20 border-cyan-800/50">
                {overview ? (
                  <BookingsCalendar bookings={overview.bookings} tripColor={overview.trip.color} trip={overview.trip} />
                ) : (
                  <p className="text-sm text-zinc-500">Select a trip to view booking dates on the calendar.</p>
                )}
              </SectionCard>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BookingsSection
                  activeTripId={activeTripId}
                  canEdit={canEditActiveTrip}
                  bookings={overview?.bookings ?? []}
                  documentsByBookingId={documentsByBookingId}
                  onChanged={handleOverviewChanged}
                />
                <ChecklistSection
                  activeTripId={activeTripId}
                  canEdit={canEditActiveTrip}
                  checklist={overview?.checklist ?? []}
                  onChanged={handleOverviewChanged}
                />
                <CompanionsSection
                  activeTripId={activeTripId}
                  canEdit={canEditActiveTrip}
                  companions={overview?.companions ?? []}
                  onChanged={handleOverviewChanged}
                />
                <SharingSection activeTrip={activeTrip} canEdit={canEditActiveTrip} />
                <DocumentsSection
                  activeTripId={activeTripId}
                  canEdit={canEditActiveTrip}
                  documents={overview?.documents ?? []}
                  bookings={overview?.bookings ?? []}
                  onChanged={handleOverviewChanged}
                />
                <TripOverviewCards activeTrip={activeTrip} overview={overview} loadingOverview={loadingOverview} />
              </div>

              {overview && activeTrip && (
                <DayByDay
                  trip={overview.trip}
                  bookings={overview.bookings}
                  dayNotes={overview.dayNotes}
                  canEdit={canEditActiveTrip}
                  onChanged={handleOverviewChanged}
                />
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
