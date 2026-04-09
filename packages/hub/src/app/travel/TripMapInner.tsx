'use client';

import { useEffect, useRef } from 'react';
import type { Map as LeafletMap, LatLngTuple } from 'leaflet';
import type { TripMapData } from '@my-hub/shared/services';

type TripMapInnerProps = {
  mapData: TripMapData;
};

export function TripMapInner({ mapData }: TripMapInnerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapData.points.length < 2) return;

    import('leaflet').then((L) => {
      if (!containerRef.current || mapRef.current) return;

      // Fix default icon paths broken by bundlers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current!).setView([20, 0], 2);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      const bounds: LatLngTuple[] = [];

      for (const pt of mapData.points) {
        const popup = document.createElement('div');
        const label = document.createElement('strong');
        label.textContent = pt.label;
        popup.appendChild(label);

        if (pt.sub) {
          popup.appendChild(document.createElement('br'));
          const sub = document.createElement('span');
          sub.style.color = '#aaa';
          sub.textContent = pt.sub;
          popup.appendChild(sub);
        }
        L.marker([pt.lat, pt.lng]).bindPopup(popup).addTo(map);
        bounds.push([pt.lat, pt.lng]);
      }

      for (const arc of mapData.arcs) {
        L.polyline([arc.from, arc.to], {
          color: '#38bdf8',
          weight: 1.5,
          dashArray: '6 4',
          opacity: 0.7,
        }).addTo(map);
      }

      if (bounds.length >= 2) {
        map.fitBounds(bounds, { padding: [32, 32] });
      }
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [mapData]);

  if (mapData.points.length < 2) return null;

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossOrigin="" />
      <div
        ref={containerRef}
        data-testid="trip-map-container"
        style={{ height: '320px', width: '100%', borderRadius: '0.5rem' }}
      />
    </>
  );
}
