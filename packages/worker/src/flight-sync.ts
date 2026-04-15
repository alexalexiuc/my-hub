import {
  backOffFlightData,
  fetchFlightFromApi,
  getFlightDataDueForFetch,
  updateFlightData,
} from '@my-hub/shared/services';
import { workerEnvConfig } from './config/env';
import { logger } from '@my-hub/shared/utils';

export async function syncDueFlights(): Promise<void> {
  const apiKey = workerEnvConfig.RAPIDAPI_KEY;
  if (!apiKey) {
    // Worker is functional but won't fetch until RAPIDAPI_KEY is provided.
    return;
  }

  const due = await getFlightDataDueForFetch();
  if (due.length === 0) return;

  logger.info(`[worker] Syncing ${due.length} flight(s)...`);

  for (const fd of due) {
    // wait 1 second to not hit rate limits
    await new Promise((res) => setTimeout(res, 1000));
    try {
      const result = await fetchFlightFromApi(fd.flightNumber, fd.flightDate, apiKey);

      if (result) {
        await updateFlightData(fd.id, {
          originIata: result.originIata,
          destinationIata: result.destinationIata,
          scheduledDepartureAt: result.scheduledDepartureAt,
          scheduledArrivalAt: result.scheduledArrivalAt,
          actualDepartureAt: result.actualDepartureAt,
          actualArrivalAt: result.actualArrivalAt,
          departureTerminal: result.departureTerminal,
          departureGate: result.departureGate,
          arrivalTerminal: result.arrivalTerminal,
          status: result.status,
          aircraftType: result.aircraftType,
          aircraftRegistration: result.aircraftRegistration,
          airlineIata: result.airlineIata,
          airlineName: result.airlineName,
          rawResponse: result.rawResponse,
        });
        logger.info(
          `[worker] Updated ${fd.flightNumber}/${fd.flightDate}: status=${result.status ?? 'n/a'}, gate=${result.departureGate ?? '-'}`,
        );
      } else {
        // Flight not found — back off but keep auto-updating (may appear closer to date)
        await backOffFlightData(fd.id, fd.scheduledDepartureAt, fd.actualArrivalAt);
        logger.info(`[worker] No data for ${fd.flightNumber}/${fd.flightDate}, backing off`);
      }
    } catch (err) {
      logger.error(`[worker] Error syncing ${fd.flightNumber}/${fd.flightDate}:`, err);
      await backOffFlightData(fd.id, fd.scheduledDepartureAt, fd.actualArrivalAt).catch(() => {});
    }
  }
}
