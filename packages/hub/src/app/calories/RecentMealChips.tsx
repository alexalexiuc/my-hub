'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/utils';
import type { RecentMealSuggestion } from '@my-hub/shared/services';
import type { MealType } from '@my-hub/shared/constants';
import { sortSuggestionsForMealType } from './calories.utils';

type RecentMealChipsProps = {
  /** The meal type currently selected in the form — decides which suggestions lead the row. */
  mealType: MealType;
  onPick: (meal: RecentMealSuggestion) => void;
};

/**
 * One-tap re-log of something already eaten before. Logging a repeat meal used to mean retyping
 * a description and four numbers every time, which is most of the friction in a tracker that
 * only pays off when it is used daily.
 *
 * Renders nothing until suggestions arrive, and nothing at all for a user with no history —
 * an empty "Recent" heading above a blank row is worse than no heading.
 */
export function RecentMealChips({ mealType, onPick }: RecentMealChipsProps) {
  const [suggestions, setSuggestions] = useState<RecentMealSuggestion[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ meals: RecentMealSuggestion[] }>('/api/calories/meals/recent', { silentToast: true })
      .then(data => {
        if (!cancelled) setSuggestions(data.meals);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (suggestions.length === 0) return null;

  const ordered = sortSuggestionsForMealType(suggestions, mealType);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[9px] uppercase tracking-[0.07em] text-[var(--subtle)]">Log again</span>
      {/* A single scrolling row rather than a wrapping block: the chips are a shortcut, and a
          shortcut that pushes the form itself off a phone screen has cost more than it saved. */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {ordered.map(meal => (
          <button
            key={`${meal.description}:${meal.mealType}`}
            type="button"
            onClick={() => onPick(meal)}
            title={meal.description}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card2)] px-3 py-1.5 text-[12px] text-[var(--text)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <span className="max-w-[140px] truncate">{meal.description}</span>
            {meal.kcal !== null && <span className="shrink-0 text-[var(--subtle)]">{meal.kcal}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
