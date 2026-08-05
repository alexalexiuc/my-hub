'use client';

import { useEffect, useState } from 'react';
import type { CalorieProfile } from '@my-hub/shared/types';
import type { GymTime } from '@my-hub/shared/constants';
import { apiFetch } from '@/lib/utils';

/**
 * The user's training time band, for components that order meal slots but have no other reason
 * to load the profile. Pass `known` when the caller already has the profile to skip the request
 * entirely; pass nothing to have the hook fetch it.
 *
 * Returns null until the request resolves, and on failure. That is the same value an unset band
 * produces, and `mealOrder(null)` is the order the UI used before the band existed — so a slow
 * or failed profile fetch costs the ordering, never the screen.
 */
export function useGymTime(known?: GymTime | null | undefined): GymTime | null {
  const [fetched, setFetched] = useState<GymTime | null>(null);
  // A caller that already holds the profile passes it in, and no request is made — the alternative
  // was the meal modal re-reading the profile a component below the page that had just loaded it.
  const shouldFetch = known === undefined;

  useEffect(() => {
    if (!shouldFetch) return;
    // Guarded rather than fire-and-forget: a modal closed before the response lands would
    // otherwise set state on an unmounted component.
    let cancelled = false;
    apiFetch<{ profile: CalorieProfile | null }>('/api/calories/profile', { silentToast: true })
      .then(data => {
        if (!cancelled) setFetched(data.profile?.gymTime ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [shouldFetch]);

  return known ?? fetched;
}
