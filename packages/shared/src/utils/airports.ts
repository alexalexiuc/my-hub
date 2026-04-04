import airportsJson from 'airports-data/airports.json' with { type: 'json' };

interface AirportEntry {
  iata: string | null;
  tz: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface AirportCoords {
  lat: number;
  lng: number;
}

// Build IATA → entry map once at module load
const iataMap = new Map<string, AirportEntry>();
for (const entry of Object.values(airportsJson) as AirportEntry[]) {
  if (entry.iata && entry.iata !== 'N/A') {
    iataMap.set(entry.iata, entry);
  }
}

/** Returns the IANA timezone string for an IATA airport code, or null if unknown. */
export function timezoneFromIata(iata: string): string | null {
  return iataMap.get(iata.toUpperCase())?.tz ?? null;
}

/** Returns lat/lng for an IATA airport code, or null if unknown. */
export function coordsFromIata(iata: string): AirportCoords | null {
  const entry = iataMap.get(iata.toUpperCase());
  if (!entry || entry.latitude == null || entry.longitude == null) return null;
  return { lat: entry.latitude, lng: entry.longitude };
}
