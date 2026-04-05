'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { SectionCard } from '@/components/SectionCard';
import type { TripMapData } from '@my-hub/shared/services';

export interface TripMapProps {
  mapData: TripMapData;
  tripId: number | null;
}

// Inner component loaded only on the client to avoid Leaflet SSR crash
const TripMapInner = dynamic(() => import('./TripMapInner'), { ssr: false, loading: () => null });

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
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          className="rounded-md border border-teal-700 bg-teal-900/30 px-2.5 py-1 text-xs font-medium text-teal-300 hover:bg-teal-800/40"
        >
          {isExpanded ? 'Hide map' : 'Show map'}
        </button>
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
