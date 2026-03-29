/**
 * AeroDataBox flight data client (via RapidAPI).
 *
 * Free tier: 4 000 requests / month.
 * Docs: https://doc.aerodatabox.com
 *
 * Required env var: RAPIDAPI_KEY
 * Endpoint: GET https://aerodatabox.p.rapidapi.com/flights/iata/{flightNumber}/{date}
 */

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAeroDataBox(raw: any): FlightApiResult {
  // AeroDataBox returns an array; first element is the matching flight
  const flight = Array.isArray(raw) ? raw[0] : raw;
  if (!flight) return {};

  const dep = flight.departure ?? {};
  const arr = flight.arrival ?? {};
  const aircraft = flight.aircraft ?? {};
  const airline = flight.airline ?? {};

  return {
    originIata: dep.airport?.iata ?? undefined,
    destinationIata: arr.airport?.iata ?? undefined,
    scheduledDepartureAt: parseDate(dep.scheduledTimeUtc ?? dep.scheduledTimeLocal),
    scheduledArrivalAt: parseDate(arr.scheduledTimeUtc ?? arr.scheduledTimeLocal),
    actualDepartureAt: parseDate(dep.actualTimeUtc ?? dep.revisedTimeUtc),
    actualArrivalAt: parseDate(arr.actualTimeUtc ?? arr.revisedTimeUtc),
    departureTerminal: dep.terminal ?? undefined,
    departureGate: dep.gate ?? undefined,
    arrivalTerminal: arr.terminal ?? undefined,
    status: flight.status ?? undefined,
    aircraftType: aircraft.model ?? undefined,
    aircraftRegistration: aircraft.reg ?? undefined,
    airlineIata: airline.iata ?? undefined,
    airlineName: airline.name ?? undefined,
    rawResponse: raw,
  };
}

/**
 * Fetch live flight data for the given IATA flight number and date (YYYY-MM-DD).
 * Returns null when the flight is not found or the API key is not set.
 */
export async function fetchFlightFromApi(
  flightNumber: string,
  flightDate: string,
  apiKey: string,
): Promise<FlightApiResult | null> {
  const url = `https://aerodatabox.p.rapidapi.com/flights/iata/${encodeURIComponent(flightNumber)}/${encodeURIComponent(flightDate)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com',
      },
    });
  } catch (err) {
    throw new Error(`AeroDataBox network error: ${String(err)}`);
  }

  if (response.status === 404) return null;

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`AeroDataBox API error ${response.status}: ${body}`);
  }

  const json = await response.json();
  return mapAeroDataBox(json);
}
