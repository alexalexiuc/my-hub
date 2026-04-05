'use client';

import dynamic from 'next/dynamic';
import type { TripMapData } from '@my-hub/shared/services';

export interface TripMapProps {
  mapData: TripMapData;
}

// Inner component loaded only on the client to avoid Leaflet SSR crash
const TripMapInner = dynamic(() => import('./TripMapInner'), { ssr: false, loading: () => null });

export function TripMap(props: TripMapProps) {
  return <TripMapInner {...props} />;
}
