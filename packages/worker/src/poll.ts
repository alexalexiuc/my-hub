import { syncDueFlights } from './flight-sync.js';

const POLL_INTERVAL_MS = 60_000; // wake up every 60 s

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function startPollLoop(): Promise<never> {
  console.log('[worker] Poll loop started. Interval:', POLL_INTERVAL_MS / 1000, 's');

  while (true) {
    try {
      await syncDueFlights();
    } catch (err) {
      console.error('[worker] Unexpected error during sync cycle:', err);
    }
    await sleep(POLL_INTERVAL_MS);
  }
}
