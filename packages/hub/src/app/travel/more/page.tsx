'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { Card } from '@/components';
import { TravelSectionHeader } from '../ui';
import type { TripOverviewResponse, ApiTrip } from '../types';
import { travelEvents } from '../travelEvents';
import { readActiveTripId } from '../TripSwitcher';
import { TripSwitcher } from '../TripSwitcher';
import { CompanionsSection } from '../CompanionsSection';
import { DocumentsSection } from '../DocumentsSection';
import { SharingSection } from '../SharingSection';
import { TripMap } from '../TripMap';
import { BookingsCalendar } from '../BookingsCalendar';

export default function TravelMorePage() {
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

  const canEdit = overview?.canEdit ?? false;

  const activeApiTrip = useMemo(() => (overview ? (overview.trip as unknown as ApiTrip) : null), [overview]);

  return (
    <main className="mx-auto max-w-7xl space-y-4">
      <TripSwitcher />

      {!activeTripId ? (
        <p className="text-sm text-[var(--muted)]">Select a trip to view details.</p>
      ) : (
        <>
          {overview && (
            <>
              <TripMap mapData={overview.mapData} tripId={activeTripId} />
              <Card className="!p-0 overflow-hidden">
                <TravelSectionHeader title="Calendar" />
                <div className="p-4">
                  <BookingsCalendar bookings={overview.bookings} tripColor={overview.trip.color} trip={overview.trip} />
                </div>
              </Card>
            </>
          )}
          <CompanionsSection
            activeTripId={activeTripId}
            canEdit={canEdit}
            companions={overview?.companions ?? []}
            onChanged={loadData}
          />
          <DocumentsSection
            activeTripId={activeTripId}
            canEdit={canEdit}
            documents={overview?.documents ?? []}
            bookings={overview?.bookings ?? []}
            onChanged={loadData}
          />
          {activeApiTrip && <SharingSection activeTrip={activeApiTrip} canEdit={canEdit} />}
        </>
      )}
    </main>
  );
}
