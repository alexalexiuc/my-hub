import {
  backOffFlightData,
  fetchFlightFromApi,
  getFlightDataDueForFetch,
  updateFlightData,
} from '@my-hub/shared/services';

export async function syncDueFlights(): Promise<void> {
  const apiKey = process.env['RAPIDAPI_KEY'];
  if (!apiKey) {
    // Worker is functional but won't fetch until RAPIDAPI_KEY is provided.
    return;
  }

  const due = await getFlightDataDueForFetch();
  if (due.length === 0) return;

  console.log(`[worker] Syncing ${due.length} flight(s)...`);

  for (const fd of due) {
    try {
      const result = await fetchFlightFromApi(fd.flightNumber, fd.flightDate, apiKey);

      if (result) {
        await updateFlightData(fd.id, {
          originIata: result.originIata,
          destinationIata: result.destinationIata,
          scheduledDepartureAt: result.scheduledDepartureAt ?? null,
          scheduledArrivalAt: result.scheduledArrivalAt ?? null,
          actualDepartureAt: result.actualDepartureAt ?? null,
          actualArrivalAt: result.actualArrivalAt ?? null,
          departureTerminal: result.departureTerminal,
          departureGate: result.departureGate,
          arrivalTerminal: result.arrivalTerminal,
          status: result.status,
          aircraftType: result.aircraftType,
          aircraftRegistration: result.aircraftRegistration,
          airlineIata: result.airlineIata,
          airlineName: result.airlineName,
          rawResponse: result.rawResponse as Record<string, unknown>,
        });
        console.log(
          `[worker] Updated ${fd.flightNumber}/${fd.flightDate}: status=${result.status ?? 'n/a'}, gate=${result.departureGate ?? '-'}`,
        );
      } else {
        // Flight not found — back off but keep auto-updating (may appear closer to date)
        await backOffFlightData(fd.id, fd.scheduledDepartureAt, fd.actualArrivalAt);
        console.log(`[worker] No data for ${fd.flightNumber}/${fd.flightDate}, backing off`);
      }
    } catch (err) {
      console.error(`[worker] Error syncing ${fd.flightNumber}/${fd.flightDate}:`, err);
      await backOffFlightData(fd.id, fd.scheduledDepartureAt, fd.actualArrivalAt).catch(() => {});
    }
  }
}
