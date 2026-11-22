'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CalorieProfile } from '@my-hub/shared/types';
import type { MeasurementWithType } from '@my-hub/shared/services';
import { apiFetch, ApiError } from '@/lib/utils';
import { useRefetchOnVisible } from '@/hooks/useRefetchOnVisible';
import { NOT_SIGNED_IN } from './ui';

type ProfileResponse = { profile: CalorieProfile | null; measurements: MeasurementWithType[] };

const NO_MEASUREMENTS: MeasurementWithType[] = [];

/** The message a page shows for a failed load — "Not signed in" for a 401. */
export function loadErrorMessage(e: unknown): string {
  if (e instanceof ApiError && e.status === 401) return NOT_SIGNED_IN;
  return e instanceof Error ? e.message : String(e);
}

type UseCalorieProfileOptions = {
  /** Make no request at all — for a caller that already holds the profile. */
  skip?: boolean;
  /** No error toast for the first load either — for callers that degrade quietly without it. */
  silent?: boolean;
};

/**
 * The calorie profile and the latest measurement of each type (`GET /api/calories/profile`) — the
 * one loader every calories surface uses instead of fetching it itself.
 *
 * Reloads quietly when the user comes back to the page (`useRefetchOnVisible`), since Claude and
 * the automation API log weigh-ins while a page sits open. `reload(true)` is such a background
 * refresh: no toast, and a failure keeps what's on screen. `error` is set only while there is
 * nothing to show, i.e. after a failed first load.
 */
export function useCalorieProfile({ skip = false, silent = false }: UseCalorieProfileOptions = {}) {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasData = useRef(false);
  // Bumped on unmount, and by every load: only the latest response may land.
  const requestId = useRef(0);

  const reload = useCallback(
    async (background = false) => {
      const id = ++requestId.current;
      try {
        const fresh = await apiFetch<ProfileResponse>('/api/calories/profile', { silentToast: background || silent });
        if (id !== requestId.current) return;
        hasData.current = true;
        setData(fresh);
        setError(null);
      } catch (e) {
        if (id === requestId.current && !hasData.current) setError(loadErrorMessage(e));
      }
    },
    [silent],
  );

  useEffect(() => {
    if (skip) return;
    void reload();
    return () => {
      requestId.current += 1;
    };
  }, [skip, reload]);

  useRefetchOnVisible(async () => {
    if (!skip) await reload(true);
  });

  return {
    profile: data?.profile ?? null,
    measurements: data?.measurements ?? NO_MEASUREMENTS,
    loading: !skip && data === null && error === null,
    error,
    reload,
  };
}
