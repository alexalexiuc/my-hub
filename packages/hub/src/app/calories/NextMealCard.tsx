'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { z } from 'zod';
import { apiFetch, cn } from '@/lib/utils';
import { Button, Card } from '@/components';
import { AnimatedCheckIcon, UtensilsOutlineIcon } from '@/components/icons';
import { TodayPlanResponseSchema } from '@/app/api/calories/menu/menu.schemas';
import { mealOrder } from '@my-hub/shared/utils';
import type { GymTime, MealType } from '@my-hub/shared/constants';
import type { MealLog } from '@my-hub/shared/types';
import { MEAL_LABEL } from './constants';
import { setMealLogged } from './menu/menu.utils';
import { mealEvents } from './mealEvents';

type PlannedMeal = z.infer<typeof TodayPlanResponseSchema>['meals'][number];

type NextMealCardProps = {
  /** The day being viewed, YYYY-MM-DD. */
  date: string;
};

// How long the drawn checkmark stays up before the card swaps to the next meal. Long enough
// that the draw animation (~480ms incl. its start delay) is fully visible even on a fast network.
const CHECK_HOLD_MS = 600;

/**
 * What the weekly menu says you eat next, surfaced on the page you actually land on. Without it
 * the plan lives only inside the Weekly Menu tab: you have to go looking for it, on a screen
 * built to answer "how does my week look" rather than "what now".
 *
 * Renders nothing when the day has no plan — an empty card would be noise on every day you
 * haven't planned.
 */
export function NextMealCard({ date }: NextMealCardProps) {
  const [meals, setMeals] = useState<PlannedMeal[]>([]);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [gymTime, setGymTime] = useState<GymTime | null>(null);
  // Meal types actually logged for the day, from the calorie journal directly — not just the
  // ones logged against this exact planned dish. A meal logged some other way (the generic
  // meal-log modal, `calories_log_meal`) fills a slot just as much as clicking "Log it" here does.
  const [loggedMealTypes, setLoggedMealTypes] = useState<Set<MealType>>(new Set());
  const [logging, setLogging] = useState(false);
  // The just-logged meal's display info, frozen for the checkmark hold so the card doesn't
  // jump to the next meal before the "logged" animation has had a chance to play.
  const [frozen, setFrozen] = useState<{ meal: PlannedMeal; remaining: number } | null>(null);
  // Bumped once the hold ends, so the swap-in animation on the content block replays via `key`.
  const [animKey, setAnimKey] = useState(0);

  // The date this component is currently showing. Two rapid clicks on the date arrows leave two
  // requests in flight, and without this the slower one wins — the card would show one day's plan
  // while the rest of the page shows another, and "Log it" would journal a meal against a date it
  // was never planned for. The Today page guards the same race with its own ref.
  const shownDateRef = useRef(date);

  const load = useCallback(() => {
    const requested = date;
    Promise.all([
      apiFetch('/api/calories/menu/today', {
        query: { date: requested },
        responseSchema: TodayPlanResponseSchema,
      }),
      apiFetch<{ meals: MealLog[] }>('/api/calories/meals', { query: { date: requested }, silentToast: true }),
    ])
      .then(([plan, loggedRes]) => {
        if (shownDateRef.current !== requested) return;
        setMenuId(plan.menuId);
        setMeals(plan.meals);
        setGymTime(plan.gymTime);
        setLoggedMealTypes(new Set(loggedRes.meals.map(m => m.mealType)));
      })
      .catch(() => {
        if (shownDateRef.current !== requested) return;
        setMenuId(null);
        setMeals([]);
        setLoggedMealTypes(new Set());
      });
  }, [date]);

  useEffect(() => {
    shownDateRef.current = date;
    load();
  }, [date, load]);

  // A meal logged anywhere else on the page changes what "next" is. mitt's `on` returns nothing,
  // so the handler has to be removed by hand or every re-render leaves another one attached.
  useEffect(() => {
    mealEvents.on('changed', load);
    return () => mealEvents.off('changed', load);
  }, [load]);

  if (!frozen && (!menuId || meals.length === 0)) return null;

  const order = mealOrder(gymTime);
  const ordered = [...meals].sort((a, b) => order.indexOf(a.mealType) - order.indexOf(b.mealType));
  const next = ordered.find(m => !loggedMealTypes.has(m.mealType));
  const remaining = ordered.filter(m => !loggedMealTypes.has(m.mealType)).length;

  // While `frozen` is set, keep showing the meal that was just logged (and its remaining count
  // as it was before logging) so the checkmark animation isn't cut short by a background refetch.
  const meal = frozen?.meal ?? next;
  const displayRemaining = frozen?.remaining ?? remaining;

  // Takes the id as an argument: the `!menuId` guard above narrows the render body, but a closure
  // defined after it is still typed against the widened state.
  async function logNext(id: string, loggedMeal: PlannedMeal, remainingAtClick: number) {
    setLogging(true);
    try {
      await setMealLogged(id, date, loggedMeal.dayOfWeek, loggedMeal, true, { silentToast: true });
      mealEvents.emit('changed');
      setLogging(false);
      setFrozen({ meal: loggedMeal, remaining: remainingAtClick });
      await new Promise(resolve => setTimeout(resolve, CHECK_HOLD_MS));
      setFrozen(null);
      setAnimKey(k => k + 1);
    } finally {
      setLogging(false);
    }
  }

  return (
    <Card className="-mx-4 flex flex-col gap-2 border-[var(--accent)]/25 bg-[var(--accent)]/5 md:mx-0 md:border-[var(--accent)]/25">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">
          <UtensilsOutlineIcon className="size-3.5" />
          {meal ? 'Next planned meal' : "Today's plan"}
        </span>
        <Link href="/calories/menu" className="text-[11px] text-[var(--subtle)] hover:text-[var(--accent)]">
          Weekly menu →
        </Link>
      </div>

      <div key={animKey} className={cn(!frozen && 'animate-[fadeScaleIn_260ms_ease-out]')}>
        {meal ? (
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--muted)]">
                {MEAL_LABEL[meal.mealType]}
              </p>
              <p className="text-sm text-[var(--text)] leading-snug">{meal.description}</p>
              {meal.kcal != null && (
                <p className="text-[10px] text-[var(--subtle)] mt-0.5">
                  {meal.kcal} kcal
                  {displayRemaining > 1 && ` · ${displayRemaining - 1} more planned today`}
                </p>
              )}
            </div>
            {frozen ? (
              <span className="shrink-0 flex items-center justify-center size-8 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] animate-[fadeScaleIn_200ms_ease-out]">
                <AnimatedCheckIcon className="size-4" />
              </span>
            ) : next && menuId ? (
              <Button
                type="button"
                variant="accent"
                size="sm"
                loading={logging}
                onClick={() => void logNext(menuId, next, remaining)}
                className="shrink-0 px-3 py-1.5 text-xs"
              >
                Log it
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-green-400">✓ Everything planned for today is logged.</p>
        )}
      </div>
    </Card>
  );
}
