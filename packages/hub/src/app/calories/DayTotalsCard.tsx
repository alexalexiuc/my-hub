'use client';

import Link from 'next/link';
import type { DayCalorieTargets } from '@my-hub/shared/utils';
import { Card, ProgressBar } from '@/components';
import { CaloriesDonut } from './CaloriesDonut';
import type { MealTotals } from './calories.utils';
import { MACRO_COLORS } from './constants';

export type DayTotalsCardProps = {
  /** The day's totals; null while its meals load or after they failed to (`mealsError`). */
  totals: MealTotals | null;
  mealsError: string | null;
  /** The day's range; null while it hasn't arrived, so the goal is unknown rather than unset. */
  range: DayCalorieTargets | null;
  /** The range couldn't load (with `range` null). */
  rangeFailed: boolean;
  goalProtein: number | null;
};

/** What's left of the day: kcal against the day's range, and protein against its goal. */
export function DayTotalsCard({ totals, mealsError, range, rangeFailed, goalProtein }: DayTotalsCardProps) {
  if (!totals) {
    return (
      <Card className="p-5">
        <p className="text-sm text-[var(--subtle)]">
          {mealsError ? "Couldn't load this day's totals" : "Loading the day's totals…"}
        </p>
      </Card>
    );
  }

  const cap = range?.target ?? null;
  const minTarget = range?.min ?? null;
  const proteinLeft = goalProtein === null ? null : Math.max(0, Math.round(goalProtein - totals.protein));

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-4">
        <CaloriesDonut eaten={totals.kcal} cap={cap} min={minTarget} textSize="text-2xl" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm text-[var(--muted)]">
            <span className="text-lg font-bold text-[var(--text)]">{totals.kcal.toLocaleString()}</span>
            {cap !== null && <span> of {cap.toLocaleString()}</span>}
            <span className="ml-1">kcal</span>
          </p>
          {cap !== null && (
            <p className="text-xs text-[var(--subtle)]">
              {minTarget !== null ? `Aim for ${minTarget.toLocaleString()}–${cap.toLocaleString()}` : 'Daily cap'}
              {range?.isGymDay && <span className="text-[var(--accent)]"> · gym day · +{range.gymDayBonus} kcal</span>}
            </p>
          )}
          {!range && rangeFailed && (
            <p className="text-xs text-[var(--subtle)]">Couldn&apos;t load this day&apos;s goal</p>
          )}
          {range && cap === null && (
            <p className="text-xs text-[var(--subtle)]">
              No goal set.{' '}
              <Link href="/calories/settings" className="underline underline-offset-2 hover:text-[var(--text)]">
                Set up profile
              </Link>
            </p>
          )}
        </div>
      </div>

      {goalProtein !== null && proteinLeft !== null && (
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-semibold" style={{ color: MACRO_COLORS.protein }}>
              Protein
            </span>
            <span className="text-[var(--muted)]">
              {proteinLeft > 0 ? (
                <>
                  <strong className="text-[var(--text)]">{proteinLeft} g</strong> left of {goalProtein} g
                </>
              ) : (
                <strong className="text-[var(--green)]">Goal reached · {totals.protein} g</strong>
              )}
            </span>
          </div>
          <ProgressBar
            value={totals.protein}
            max={goalProtein}
            thresholds={false}
            color={MACRO_COLORS.protein}
            height={6}
          />
        </div>
      )}
    </Card>
  );
}
