'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { TripOverviewCards } from './TripOverviewCards';
import { TripsSidebar } from './TripsSidebar';

export default function TravelPage() {
  const [trips, setTrips] = useState<ApiTrip[]>([]);
  const [activeTripId, setActiveTripId] = useState<number | null>(null);
  const [overview, setOverview] = useState<TripOverviewResponse | null>(null);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [tripBookingRanges, setTripBookingRanges] = useState<Record<number, BookingRange>>({});

  const activeTrip = useMemo(() => trips.find((trip) => trip.id === activeTripId) ?? null, [trips, activeTripId]);
  const canEditActiveTrip = activeTrip?.can_edit ?? false;

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

  const loadTrips = useCallback(async () => {
    setLoadingTrips(true);
    try {
      const res = await fetch('/api/travel/trips');
      if (!res.ok) throw new Error(`Failed to load trips (${res.status})`);
      const data = (await res.json()) as { trips: ApiTrip[]; booking_ranges?: BookingRange[] };
      setTrips(data.trips);
      setTripBookingRanges(
        Object.fromEntries((data.booking_ranges ?? []).map((range) => [range.tripId, range])) as Record<
          number,
          BookingRange
        >,
      );
      if (data.trips.length === 0) {
        setActiveTripId(null);
        setOverview(null);
      } else if (!activeTripId || !data.trips.some((trip) => trip.id === activeTripId)) {
        setActiveTripId(data.trips[0]!.id);
      }
    } finally {
      setLoadingTrips(false);
    }
  }, [activeTripId]);

  const loadOverview = useCallback(async (tripId: number) => {
    setLoadingOverview(true);
    try {
      const res = await fetch(`/api/travel/trips/${tripId}/overview`);
      if (!res.ok) throw new Error(`Failed to load trip overview (${res.status})`);
      const data = (await res.json()) as TripOverviewResponse;
      setOverview(data);
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  useEffect(() => {
    if (!activeTripId) return;
    loadOverview(activeTripId);
  }, [activeTripId, loadOverview]);

  function handleOverviewChanged() {
    if (activeTripId) loadOverview(activeTripId);
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 space-y-6">
      <PageHeader title="My Travels" backHref="/" backLabel="← Home" />

      <section className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
        <TripsSidebar
          trips={trips}
          activeTripId={activeTripId}
          onSelectTrip={setActiveTripId}
          tripBookingRanges={tripBookingRanges}
          loadingTrips={loadingTrips}
          onTripsChanged={loadTrips}
          onOverviewChanged={loadOverview}
        />

        <div className="space-y-6">
          <TripOverviewCards activeTrip={activeTrip} overview={overview} loadingOverview={loadingOverview} />

          <SectionCard title="Calendar" className="bg-cyan-950/20 border-cyan-800/50">
            {overview ? (
              <BookingsCalendar bookings={overview.bookings} tripColor={overview.trip.color} />
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
          </div>
        </div>
      </section>
    </main>
  );
}
