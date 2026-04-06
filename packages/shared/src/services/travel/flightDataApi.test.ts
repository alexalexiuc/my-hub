import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fetchFlightFromApi } from './flightDataApi';
import { AeroDataBoxFlight } from './flightDataApiTypes';

// Make PromiseCacheX transparent so tests exercise the real fetch/retry logic
vi.mock('promise-cachex', () => ({
  PromiseCacheX: vi.fn().mockImplementation(() => ({
    get: (_key: string, factory: () => unknown) => factory(),
  })),
}));

const SAMPLE_RESPONSE: AeroDataBoxFlight[] = [
  {
    departure: {
      airport: {
        icao: 'LUKK',
        iata: 'RMO',
        name: 'Chişinău',
        shortName: 'Chişinău',
        municipalityName: 'Chişinău',
        location: { lat: 46.9277, lon: 28.931 },
        countryCode: 'MD',
        timeZone: 'Europe/Chisinau',
      },
      scheduledTime: { utc: '2026-06-21 02:30Z', local: '2026-06-21 05:30+03:00' },
      revisedTime: { utc: '2026-06-21 02:35Z', local: '2026-06-21 05:30+03:00' },
      runwayTime: { utc: '2026-06-21 02:40Z', local: '2026-06-21 05:40+03:00' },
      quality: ['Basic'],
    },
    arrival: {
      airport: {
        icao: 'LCLK',
        iata: 'LCA',
        name: 'Larnarca Larnaca',
        shortName: 'Larnaca',
        municipalityName: 'Larnarca',
        location: { lat: 34.8751, lon: 33.6249 },
        countryCode: 'CY',
        timeZone: 'Asia/Nicosia',
      },
      scheduledTime: { utc: '2026-06-21 05:00Z', local: '2026-06-21 08:00+03:00' },
      predictedTime: { utc: '2026-06-21 05:13Z', local: '2026-06-21 08:13+03:00' },
      runwayTime: { utc: '2026-06-21 05:10Z', local: '2026-06-21 08:10+03:00' },
      quality: ['Basic'],
    },
    lastUpdatedUtc: '2026-03-29 05:21Z',
    number: 'W4 3957',
    status: 'Expected',
    codeshareStatus: 'Unknown',
    isCargo: false,
    aircraft: { model: 'Airbus A320' },
    airline: { name: 'Wizz Air Malta', iata: 'W4', icao: 'WMT' },
  },
];

function makeResponse(status: number, body?: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(''),
  } as unknown as Response;
}

describe('fetchFlightFromApi', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('mapAeroDataBox', () => {
    it('maps all fields from the real API response shape', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(200, SAMPLE_RESPONSE)));

      const promise = fetchFlightFromApi('W4 3957', '2026-06-21', 'test-key');
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).not.toBeNull();
      expect(result!.originIata).toBe('RMO');
      expect(result!.destinationIata).toBe('LCA');
      expect(result!.scheduledDepartureAt).toEqual(new Date('2026-06-21 02:30Z'));
      expect(result!.scheduledArrivalAt).toEqual(new Date('2026-06-21 05:00Z'));
      expect(result!.actualArrivalAt).toEqual(new Date('2026-06-21 05:10Z'));
      expect(result!.actualDepartureAt).toEqual(new Date('2026-06-21 02:35Z'));
      expect(result!.status).toBe('Expected');
      expect(result!.aircraftType).toBe('Airbus A320');
      expect(result!.aircraftRegistration).toBeUndefined();
      expect(result!.airlineIata).toBe('W4');
      expect(result!.airlineName).toBe('Wizz Air Malta');
      expect(result!.departureTerminal).toBeUndefined();
      expect(result!.departureGate).toBeUndefined();
      expect(result!.arrivalTerminal).toBeUndefined();
      expect(result!.rawResponse).toEqual(SAMPLE_RESPONSE);
    });

    it('handles a single object response (not wrapped in array)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(200, SAMPLE_RESPONSE[0])));

      const promise = fetchFlightFromApi('W4 3957', '2026-06-21', 'test-key');
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result!.originIata).toBe('RMO');
      expect(result!.destinationIata).toBe('LCA');
    });
  });

  describe('HTTP error handling', () => {
    it('returns null for 404', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(404)));

      const promise = fetchFlightFromApi('XX 0000', '2026-01-01', 'test-key');
      await vi.runAllTimersAsync();

      await expect(promise).resolves.toBeNull();
    });

    it('throws for non-404 error status', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          status: 500,
          ok: false,
          text: () => Promise.resolve('Internal Server Error'),
        } as unknown as Response),
      );

      const promise = fetchFlightFromApi('W4 3957', '2026-06-21', 'test-key');
      const assertion = expect(promise).rejects.toThrow('AeroDataBox API error 500');
      await vi.runAllTimersAsync();
      await assertion;
    });

    it('wraps network-level errors', async () => {
      // withBackoffRetry only retries on 429 (result-based), not on thrown errors,
      // so a fetch rejection propagates immediately
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

      const promise = fetchFlightFromApi('W4 3957', '2026-06-21', 'test-key');
      const assertion = expect(promise).rejects.toThrow('AeroDataBox network error');
      await vi.runAllTimersAsync();
      await assertion;
    });
  });

  describe('429 retry behaviour', () => {
    it('retries on 429 and succeeds when the rate limit clears', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(makeResponse(429))
        .mockResolvedValueOnce(makeResponse(429))
        .mockResolvedValue(makeResponse(200, SAMPLE_RESPONSE));
      vi.stubGlobal('fetch', fetchMock);

      const promise = fetchFlightFromApi('W4 3957', '2026-06-21', 'test-key');
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(result!.originIata).toBe('RMO');
    });

    it('throws after exhausting all retries on persistent 429', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(429)));

      const promise = fetchFlightFromApi('W4 3957', '2026-06-21', 'test-key');
      // withBackoffRetry throws "Failed after N attempts"; fetchFlightFromApi wraps it
      const assertion = expect(promise).rejects.toThrow('AeroDataBox network error');
      await vi.runAllTimersAsync();
      await assertion;
    });
  });
});
