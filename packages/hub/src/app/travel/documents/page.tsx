'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/utils';
import type { TripOverviewResponse } from '../types';
import { travelEvents } from '../travelEvents';
import { readActiveTripId } from '../TripSwitcher';
import { TripSwitcher } from '../TripSwitcher';
import { DocumentsSection } from '../DocumentsSection';

export default function TravelDocumentsPage() {
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
        <p className="text-sm text-[var(--muted)]">Select a trip to view documents.</p>
      ) : (
        <DocumentsSection
          activeTripId={activeTripId}
          canEdit={overview?.canEdit ?? false}
          documents={overview?.documents ?? []}
          bookings={overview?.bookings ?? []}
          onChanged={loadData}
        />
      )}
    </main>
  );
}
