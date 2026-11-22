'use client';

import type { GymTime } from '@my-hub/shared/constants';
import { useCalorieProfile } from './useCalorieProfile';

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
  const { profile } = useCalorieProfile({ skip: known !== undefined, silent: true });
  return known !== undefined ? known : (profile?.gymTime ?? null);
}
