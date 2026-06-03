'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/utils';
import type { TripOverviewResponse, ApiTrip } from '../types';
import { travelEvents } from '../travelEvents';
import { readActiveTripId } from '../TripSwitcher';
import { TripSwitcher } from '../TripSwitcher';
import { SharingSection } from '../SharingSection';

export default function TravelSharingPage() {
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

  const activeApiTrip = useMemo(() => (overview ? (overview.trip as unknown as ApiTrip) : null), [overview]);

  return (
    <main className="mx-auto max-w-7xl space-y-5">
      <TripSwitcher />
      {!activeTripId ? (
        <p className="text-sm text-[var(--muted)]">Select a trip to manage sharing.</p>
      ) : (
        <SharingSection activeTrip={activeApiTrip} canEdit={overview?.canEdit ?? false} />
      )}
    </main>
  );
}
