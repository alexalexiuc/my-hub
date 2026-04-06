/**
 * AeroDataBox flight data client (via RapidAPI).
 *
 * Free tier: 600 requests / month.
 * Docs: https://doc.aerodatabox.com
 *
 * Required env var: RAPIDAPI_KEY
 * Endpoint: GET https://aerodatabox.p.rapidapi.com/flights/number/{flightNumber}/{date}
 */

import { PromiseCacheX } from 'promise-cachex';
import { withBackoffRetry } from '../../utils';
import { AeroDataBoxFlight } from './flightDataApiTypes';

export interface FlightApiResult {
  originIata?: string;
  destinationIata?: string;
  scheduledDepartureAt?: Date;
  scheduledArrivalAt?: Date;
  actualDepartureAt?: Date;
  actualArrivalAt?: Date;
  departureTerminal?: string;
  departureGate?: string;
  arrivalTerminal?: string;
  status?: string;
  aircraftType?: string;
  aircraftRegistration?: string;
  airlineIata?: string;
  airlineName?: string;
  rawResponse?: unknown;
}

function parseDate(value: unknown): Date | undefined {
  if (!value || typeof value !== 'string') return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

function mapAeroDataBox(raw: AeroDataBoxFlight | AeroDataBoxFlight[]): FlightApiResult {
  const flight = Array.isArray(raw) ? raw[0] : raw;
  if (!flight) return {};

  const dep = flight.departure ?? {};
  const arr = flight.arrival ?? {};
  const aircraft = flight.aircraft ?? {};
  const airline = flight.airline ?? {};

  return {
    originIata: dep.airport?.iata,
    destinationIata: arr.airport?.iata,
    scheduledDepartureAt: parseDate(dep.scheduledTime?.utc),
    scheduledArrivalAt: parseDate(arr.scheduledTime?.utc),
    actualDepartureAt: parseDate(dep.revisedTime?.utc ?? dep.runwayTime?.utc),
    actualArrivalAt: parseDate(arr.revisedTime?.utc ?? arr.runwayTime?.utc),
    departureTerminal: dep.terminal,
    departureGate: dep.gate,
    arrivalTerminal: arr.terminal,
    status: flight.status,
    aircraftType: aircraft.model,
    aircraftRegistration: aircraft.reg,
    airlineIata: airline.iata,
    airlineName: airline.name,
    rawResponse: raw,
  };
}

const flightApiCache = new PromiseCacheX({
  ttl: 5 * 60 * 1000, // 5 mins
});

const fetchApi = (flightNumber: string, flightDate: string, apiKey: string) => {
  // Cache API responses to avoid hitting rate limits, especially since flight data doesn't change frequently and we are also limited on requests
  return flightApiCache.get(`${flightNumber}-${flightDate}`, async () => {
    const url = `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(flightNumber)}/${encodeURIComponent(flightDate)}?withAircraftImage=false&withLocation=false&withFlightPlan=false&dateLocalRole=Both`;
    const response = await withBackoffRetry(
      () =>
        fetch(url, {
          headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com',
            'Content-Type': 'application/json',
          },
        }),
      {
        // we have 1 attempt per second on the free tier, so we want to retry on rate limit errors
        shouldRetry: (result) => result?.status === 429, // Retry on rate limit errors,
      },
    );

    return response;
  });
};

/**
 * Fetch live flight data for the given IATA flight number and date (YYYY-MM-DD).
 * Returns null when the flight is not found or the API key is not set.
 */
export async function fetchFlightFromApi(
  flightNumber: string,
  flightDate: string,
  apiKey: string,
): Promise<FlightApiResult | null> {
  let response: Response;
  try {
    response = await fetchApi(flightNumber, flightDate, apiKey);
  } catch (err) {
    throw new Error(`AeroDataBox network error: ${String(err)}`);
  }

  if (response.status === 404) return null;

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`AeroDataBox API error ${response.status}: ${body}`);
  }

  return mapAeroDataBox((await response.json()) as AeroDataBoxFlight | AeroDataBoxFlight[]);
}
