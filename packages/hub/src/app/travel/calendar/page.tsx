'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { SectionCard } from '@/components/SectionCard';
import type { TripOverviewResponse } from '../types';
import { travelEvents } from '../travelEvents';
import { readActiveTripId } from '../TripSwitcher';
import { TripSwitcher } from '../TripSwitcher';
import { BookingsCalendar } from '../BookingsCalendar';

export default function TravelCalendarPage() {
  const [overview, setOverview] = useState<TripOverviewResponse | null>(null);
  const [activeTripId, setActiveTripId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    const tripId = readActiveTripId();
    setActiveTripId(tripId);
    if (!tripId) {
      setOverview(null);
      return;
    }
    try {
      const data = await apiFetch<TripOverviewResponse>(`/api/travel/trips/${tripId}/overview`);
      setOverview(data);
    } catch {}
  }, []);

  useEffect(() => {
    loadData();
    travelEvents.on('changed', loadData);
    return () => travelEvents.off('changed', loadData);
  }, [loadData]);

  return (
    <main className="mx-auto max-w-7xl space-y-5">
      <TripSwitcher />

      {!activeTripId ? (
        <p className="text-sm text-[var(--muted)]">Select a trip to view the calendar.</p>
      ) : overview ? (
        <SectionCard title="Calendar" className="bg-[var(--card)] border-[var(--border)]">
          <BookingsCalendar bookings={overview.bookings} tripColor={overview.trip.color} trip={overview.trip} />
        </SectionCard>
      ) : null}
    </main>
  );
}
