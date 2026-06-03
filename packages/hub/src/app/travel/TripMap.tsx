'use client';

import dynamic from 'next/dynamic';
import { SectionCard } from '@/components/SectionCard';
import type { TripMapData } from '@my-hub/shared/services';

export type TripMapProps = {
  mapData: TripMapData;
  tripId: number | null;
};

const TripMapInner = dynamic(() => import('./TripMapInner').then(m => ({ default: m.TripMapInner })), {
  ssr: false,
  loading: () => (
    <div className="flex h-[500px] items-center justify-center rounded-xl bg-[var(--card2)]">
      <span className="text-sm text-[var(--muted)]">Loading map…</span>
    </div>
  ),
});

export function TripMap({ mapData }: TripMapProps) {
  if (mapData.points.length < 2) {
    return (
      <SectionCard title="Map" className="bg-[var(--card)] border-[var(--border)]">
        <p className="text-sm text-[var(--muted)]">
          No location data yet. Bookings with IATA codes or place coordinates will appear here.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Map" className="!p-0 overflow-hidden bg-[var(--card)] border-[var(--border)]">
      <TripMapInner mapData={mapData} />
    </SectionCard>
  );
}
