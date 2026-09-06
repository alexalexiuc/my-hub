'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import type { TripMapData } from '@my-hub/shared/services';

type TripMapInnerProps = {
  mapData: TripMapData;
};

/** Interpolates a great-circle arc between two [lat, lng] pairs. Returns [lng, lat] for MapLibre. */
function greatCircleArc(from: [number, number], to: [number, number], steps = 64): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const [lat1, lon1] = from;
  const [lat2, lon2] = to;
  const φ1 = toRad(lat1),
    λ1 = toRad(lon1);
  const φ2 = toRad(lat2),
    λ2 = toRad(lon2);
  const d =
    2 * Math.asin(Math.sqrt(Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2));
  if (d === 0) return [[lon1, lat1]];
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    pts.push([toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))]);
  }
  return pts;
}

/**
 * MapLibre paints onto a canvas and into popup DOM it owns, so its paint properties and marker
 * styles need literal colour values rather than `var(--token)`. Read them off the themed
 * container instead of hardcoding, so the map follows the user's chosen theme.
 */
function readThemeTokens(el: HTMLElement) {
  const s = getComputedStyle(el);
  const token = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return {
    accent: token('--accent', '#10b981'),
    accentShadow: token('--accent-shadow', 'rgba(16, 185, 129, 0.7)'),
    text: token('--text', '#eafaf4'),
  };
}

export function TripMapInner({ mapData }: TripMapInnerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let destroyed = false;
    const theme = readThemeTokens(containerRef.current);

    import('maplibre-gl').then(({ default: maplibregl }) => {
      if (destroyed || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: [0, 20],
        zoom: 1.5,
        attributionControl: false,
        logoPosition: 'bottom-right',
      });

      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

      map.on('load', () => {
        // Flight arc lines
        if (mapData.arcs.length > 0) {
          map.addSource('arcs', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: mapData.arcs.map((arc, i) => ({
                type: 'Feature' as const,
                id: i,
                properties: {},
                geometry: { type: 'LineString' as const, coordinates: greatCircleArc(arc.from, arc.to) },
              })),
            },
          });
          // Glow layer (wide, faint)
          map.addLayer({
            id: 'arcs-glow',
            type: 'line',
            source: 'arcs',
            paint: { 'line-color': theme.accent, 'line-width': 6, 'line-opacity': 0.12 },
          });
          // Main arc line
          map.addLayer({
            id: 'arcs-line',
            type: 'line',
            source: 'arcs',
            paint: {
              'line-color': theme.accent,
              'line-width': 1.5,
              'line-opacity': 0.7,
              'line-dasharray': [4, 3],
            },
          });
        }

        // Location markers
        for (const pt of mapData.points) {
          const dot = document.createElement('div');
          dot.style.cssText =
            `width:10px;height:10px;border-radius:50%;background:${theme.accent};` +
            `border:2px solid ${theme.text};box-shadow:0 0 8px ${theme.accentShadow}`;

          const popup = new maplibregl.Popup({ offset: 14, closeButton: false, className: 'travel-map-popup' }).setHTML(
            `<strong style="color:var(--text);font-size:13px">${pt.label}</strong>${
              pt.sub ? `<br><span style="color:var(--muted);font-size:11px">${pt.sub}</span>` : ''
            }`,
          );

          new maplibregl.Marker({ element: dot }).setLngLat([pt.lng, pt.lat]).setPopup(popup).addTo(map);
        }

        // Fit map to all points
        if (mapData.points.length >= 2) {
          const bounds = new maplibregl.LngLatBounds();
          for (const pt of mapData.points) bounds.extend([pt.lng, pt.lat]);
          map.fitBounds(bounds, { padding: 60, maxZoom: 9, duration: 0 });
        }
      });

      // Cleanup on unmount
      (containerRef.current as HTMLDivElement & { _mlMap?: maplibregl.Map })._mlMap = map;
    });

    return () => {
      destroyed = true;
      const el = containerRef.current as (HTMLDivElement & { _mlMap?: import('maplibre-gl').Map }) | null;
      el?._mlMap?.remove();
    };
  }, [mapData]);

  return (
    <>
      <style>{`
        .travel-map-popup .maplibregl-popup-content {
          background: var(--card2);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 8px 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.6);
        }
        .travel-map-popup .maplibregl-popup-tip { border-top-color: var(--border); }
        .maplibregl-ctrl-attrib { font-size: 10px !important; opacity: 0.5; }
      `}</style>
      <div
        ref={containerRef}
        data-testid="trip-map-container"
        style={{ height: '500px', width: '100%', borderRadius: '0.75rem', overflow: 'hidden' }}
      />
    </>
  );
}
