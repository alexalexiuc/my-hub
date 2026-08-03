'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { z } from 'zod';
import { apiFetch } from '@/lib/utils';
import { Button } from '@/components';
import { UtensilsOutlineIcon } from '@/components/icons';
import { TodayPlanResponseSchema } from '@/app/api/calories/menu/menu.schemas';
import { mealOrder } from '@my-hub/shared/utils';
import type { GymTime } from '@my-hub/shared/constants';
import { MEAL_LABEL } from './constants';
import { setMealLogged } from './menu/menu.utils';
import { mealEvents } from './mealEvents';

type PlannedMeal = z.infer<typeof TodayPlanResponseSchema>['meals'][number];

type NextMealCardProps = {
  /** The day being viewed, YYYY-MM-DD. */
  date: string;
};

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
  const [logging, setLogging] = useState(false);

  // The date this component is currently showing. Two rapid clicks on the date arrows leave two
  // requests in flight, and without this the slower one wins — the card would show one day's plan
  // while the rest of the page shows another, and "Log it" would journal a meal against a date it
  // was never planned for. The Today page guards the same race with its own ref.
  const shownDateRef = useRef(date);

  const load = useCallback(() => {
    const requested = date;
    apiFetch('/api/calories/menu/today', {
      query: { date: requested },
      responseSchema: TodayPlanResponseSchema,
    })
      .then(data => {
        if (shownDateRef.current !== requested) return;
        setMenuId(data.menuId);
        setMeals(data.meals);
        setGymTime(data.gymTime);
      })
      .catch(() => {
        if (shownDateRef.current !== requested) return;
        setMenuId(null);
        setMeals([]);
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

  if (!menuId || meals.length === 0) return null;

  const order = mealOrder(gymTime);
  const ordered = [...meals].sort((a, b) => order.indexOf(a.mealType) - order.indexOf(b.mealType));
  const next = ordered.find(m => !m.logged);
  const remaining = ordered.filter(m => !m.logged).length;

  // Takes the id as an argument: the `!menuId` guard above narrows the render body, but a closure
  // defined after it is still typed against the widened state.
  async function logNext(id: string, meal: PlannedMeal) {
    setLogging(true);
    try {
      await setMealLogged(id, date, meal.dayOfWeek, meal, true, { silentToast: true });
      mealEvents.emit('changed');
    } finally {
      setLogging(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/5 p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">
          <UtensilsOutlineIcon className="size-3.5" />
          {next ? 'Next planned meal' : "Today's plan"}
        </span>
        <Link href="/calories/menu" className="text-[11px] text-[var(--subtle)] hover:text-[var(--accent)]">
          Weekly menu →
        </Link>
      </div>

      {next ? (
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--muted)]">
              {MEAL_LABEL[next.mealType]}
            </p>
            <p className="text-sm text-[var(--text)] leading-snug">{next.description}</p>
            {next.kcal != null && (
              <p className="text-[10px] text-[var(--subtle)] mt-0.5">
                {next.kcal} kcal
                {remaining > 1 && ` · ${remaining - 1} more planned today`}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="accent"
            size="sm"
            loading={logging}
            onClick={() => void logNext(menuId, next)}
            className="shrink-0 px-3 py-1.5 text-xs"
          >
            Log it
          </Button>
        </div>
      ) : (
        <p className="text-sm text-green-400">✓ Everything planned for today is logged.</p>
      )}
    </div>
  );
}
