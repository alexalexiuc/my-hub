'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components';
import { SectionCard } from '@/components/SectionCard';
import type { TripMapData } from '@my-hub/shared/services';

export type TripMapProps = {
  mapData: TripMapData;
  tripId: number | null;
};

// Inner component loaded only on the client to avoid Leaflet SSR crash
const TripMapInner = dynamic(() => import('./TripMapInner').then((m) => ({ default: m.TripMapInner })), {
  ssr: false,
  loading: () => null,
});

export function TripMap({ mapData, tripId }: TripMapProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Keep map collapsed when switching trips; user can opt-in per trip.
    setIsExpanded(false);
  }, [tripId]);

  return (
    <SectionCard
      title="Map"
      className="bg-teal-950/20 border-teal-800/50"
      action={
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          className="border border-teal-700 bg-teal-900/30 px-2.5 text-teal-300 hover:bg-teal-800/40 hover:text-teal-300"
        >
          {isExpanded ? 'Hide map' : 'Show map'}
        </Button>
      }
    >
      {isExpanded ? (
        <TripMapInner mapData={mapData} />
      ) : (
        <p className="text-sm text-zinc-400">
          Map is collapsed by default. Expand it to view route and location markers.
        </p>
      )}
    </SectionCard>
  );
}
