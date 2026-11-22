import { useEffect, useRef } from 'react';

/** Minimum gap between two refreshes, so flicking between tabs doesn't refetch every time. */
const MIN_INTERVAL_MS = 30_000;

/**
 * Re-runs `refetch` when the user comes back to the page — the tab becomes visible again, or the
 * window regains focus (Claude desktop beside the browser never hides the tab). Hub pages load
 * their data once on mount, so anything Claude writes over MCP while a page sits open (a planned
 * week, a logged meal) stays invisible until a reload; this closes that gap for the page that
 * calls it.
 *
 * Always calls the latest `refetch` (no need to memoise it), runs at most once per
 * `MIN_INTERVAL_MS`, and never starts a second refresh while one is still running. The page's own
 * initial load doesn't count: coming back seconds after opening the page still refreshes.
 */
export function useRefetchOnVisible(refetch: () => Promise<unknown>): void {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    let lastRun = 0;
    let running = false;

    async function onReturn() {
      if (document.visibilityState !== 'visible' || running) return;
      if (Date.now() - lastRun < MIN_INTERVAL_MS) return;
      running = true;
      lastRun = Date.now();
      try {
        await refetchRef.current();
      } finally {
        running = false;
      }
    }

    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    return () => {
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
    };
  }, []);
}
