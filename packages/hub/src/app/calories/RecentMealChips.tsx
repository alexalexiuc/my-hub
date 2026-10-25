'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, cn } from '@/lib/utils';
import { StarIcon } from '@/components/icons';
import type { RecentMealSuggestion } from '@my-hub/shared/services';
import type { FavouriteMeal } from '@my-hub/shared/types';
import type { MealType } from '@my-hub/shared/constants';
import { mergeFavouritesWithRecent, sortSuggestionsForMealType } from './calories.utils';

type RecentMealChipsProps = {
  /** The meal type currently selected in the form — decides which suggestions lead the row. */
  mealType: MealType;
  onPick: (meal: RecentMealSuggestion) => void;
};

/**
 * One-tap re-log of something already eaten before: pinned favourites first, then recent meals.
 * Logging a repeat meal used to mean retyping a description and four numbers every time, which is
 * most of the friction in a tracker that only pays off when it is used daily. The star on each
 * chip pins or unpins it, so a staple stays at the front of the row however long ago it was eaten.
 *
 * Renders nothing until suggestions arrive, and nothing at all for a user with no history —
 * an empty heading above a blank row is worse than no heading.
 */
export function RecentMealChips({ mealType, onPick }: RecentMealChipsProps) {
  const [recent, setRecent] = useState<RecentMealSuggestion[]>([]);
  const [favourites, setFavourites] = useState<FavouriteMeal[]>([]);

  const loadFavourites = useCallback(
    () =>
      apiFetch<{ favourites: FavouriteMeal[] }>('/api/calories/meals/favourites', { silentToast: true })
        .then(data => setFavourites(data.favourites))
        .catch(() => undefined),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ meals: RecentMealSuggestion[] }>('/api/calories/meals/recent', { silentToast: true })
      .then(data => {
        if (!cancelled) setRecent(data.meals);
      })
      .catch(() => undefined);
    void loadFavourites();
    return () => {
      cancelled = true;
    };
  }, [loadFavourites]);

  async function toggleFavourite(meal: RecentMealSuggestion, favouriteId: number | null) {
    if (favouriteId !== null) {
      await apiFetch(`/api/calories/meals/favourites/${favouriteId}`, { method: 'DELETE', silentToast: true });
    } else {
      const { description, mealType: type, kcal, protein, carbs, fat } = meal;
      await apiFetch('/api/calories/meals/favourites', {
        method: 'POST',
        body: { description, mealType: type, kcal, protein, carbs, fat },
        silentToast: true,
      });
    }
    await loadFavourites();
  }

  const favouriteSuggestions = favourites.map(({ id, description, mealType: type, kcal, protein, carbs, fat }) => ({
    id,
    description,
    mealType: type,
    kcal,
    protein,
    carbs,
    fat,
  }));
  const chips = mergeFavouritesWithRecent(favouriteSuggestions, sortSuggestionsForMealType(recent, mealType));
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[9px] uppercase tracking-[0.07em] text-[var(--subtle)]">
        {favourites.length > 0 ? 'Favourites & recent' : 'Log again'}
      </span>
      {/* A single scrolling row rather than a wrapping block: the chips are a shortcut, and a
          shortcut that pushes the form itself off a phone screen has cost more than it saved. */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {chips.map(meal => {
          const pinned = meal.favouriteId !== null;
          return (
            <div
              key={`${meal.description}:${meal.mealType}`}
              className={cn(
                'flex shrink-0 items-center rounded-full border bg-[var(--card2)] text-[12px] text-[var(--text)] transition-colors hover:border-[var(--accent)]',
                pinned ? 'border-[var(--amber)]' : 'border-[var(--border)]',
              )}
            >
              <button
                type="button"
                onClick={() => onPick(meal)}
                title={meal.description}
                className="flex items-center gap-1.5 py-1.5 pl-3 hover:text-[var(--accent)]"
              >
                <span className="max-w-[140px] truncate">{meal.description}</span>
                {meal.kcal !== null && <span className="shrink-0 text-[var(--subtle)]">{meal.kcal}</span>}
              </button>
              <button
                type="button"
                onClick={() => void toggleFavourite(meal, meal.favouriteId)}
                aria-label={pinned ? `Unpin ${meal.description}` : `Pin ${meal.description} to favourites`}
                aria-pressed={pinned}
                className={cn(
                  'py-1.5 pl-1.5 pr-2.5 transition-colors',
                  pinned ? 'text-[var(--amber)]' : 'text-[var(--subtle)] hover:text-[var(--amber)]',
                )}
              >
                <StarIcon filled={pinned} className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
