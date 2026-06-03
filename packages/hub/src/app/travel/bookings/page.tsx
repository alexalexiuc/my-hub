'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/utils';
import type { TripDocument } from '@my-hub/shared/types';
import type { TripOverviewResponse } from '../types';
import { travelEvents } from '../travelEvents';
import { readActiveTripId } from '../TripSwitcher';
import { TripSwitcher } from '../TripSwitcher';
import { TripOverviewCards } from '../TripOverviewCards';
import { BookingsSection } from '../BookingsSection';

export default function TravelBookingsPage() {
  const [overview, setOverview] = useState<TripOverviewResponse | null>(null);
  const [activeTripId, setActiveTripId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    const tripId = readActiveTripId();
    setActiveTripId(tripId);
    if (!tripId) {
      setOverview(null);
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<TripOverviewResponse>(`/api/travel/trips/${tripId}/overview`);
      setOverview(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    travelEvents.on('changed', loadData);
    return () => travelEvents.off('changed', loadData);
  }, [loadData]);

  const documentsByBookingId = useMemo(() => {
    const groups = new Map<number, TripDocument[]>();
    if (!overview) return groups;
    for (const doc of overview.documents) {
      if (!doc.bookingId) continue;
      const current = groups.get(doc.bookingId) ?? [];
      current.push(doc);
      groups.set(doc.bookingId, current);
    }
    return groups;
  }, [overview]);

  const canEdit = overview?.canEdit ?? false;

  return (
    <main className="mx-auto max-w-7xl space-y-5">
      <TripSwitcher />

      {!activeTripId ? (
        <p className="text-sm text-[var(--muted)]">No trips yet — use the selector above to create your first trip.</p>
      ) : (
        <div className="space-y-4 md:grid md:grid-cols-3 md:gap-6 md:space-y-0">
          <TripOverviewCards activeTrip={overview?.trip ?? null} overview={overview} loadingOverview={loading} />
          <div className="md:col-span-2">
            <BookingsSection
              activeTripId={activeTripId}
              canEdit={canEdit}
              bookings={overview?.bookings ?? []}
              documentsByBookingId={documentsByBookingId}
              onChanged={loadData}
            />
          </div>
        </div>
      )}
    </main>
  );
}
