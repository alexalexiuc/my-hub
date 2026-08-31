'use client';

import { useState } from 'react';
import { apiFetch, cn } from '@/lib/utils';
import { Button, IconButton, ConfirmModal } from '@/components';
import { ChevronDownOutlineIcon, PencilIcon, TrashOutlineIcon } from '@/components/icons';
import type { DayOfWeek } from '@my-hub/shared/constants';
import { DeleteMenuMealSchema } from '@/app/api/calories/menu/menu.schemas';
import { MEAL_LABEL } from '@/app/calories/constants';
import { MealEditorModal } from './MealEditorModal';
import { setMealLogged } from './menu.utils';
import type { WeeklyMenuMeal } from './types';

type MealRowProps = {
  /** `boxed` (default): the rounded/bordered box used in the desktop grid. `flat`: a row with
   * just a bottom border, for `MobileDayView`'s edge-to-edge list. */
  variant?: 'boxed' | 'flat';
  meal: WeeklyMenuMeal;
  menuId: string;
  dayOfWeek: DayOfWeek;
  dayDate: string;
  /** Today, as YYYY-MM-DD. Past/future are derived from it rather than passed as separate flags. */
  today: string;
  logged: boolean;
  /** Fired after the slot's logged state flips, with the new value. */
  onLogChanged: (logged: boolean) => void;
  onSwapped: (updated: WeeklyMenuMeal) => void;
  onDeleted: () => void;
};

export function MealRow({
  variant = 'boxed',
  meal,
  menuId,
  dayOfWeek,
  dayDate,
  today,
  logged,
  onLogChanged,
  onSwapped,
  onDeleted,
}: MealRowProps) {
  // One source for the row's place in time. Taking `isFuture` and `isPast` as separate props let
  // a caller pass a pair that cannot both be true — nothing enforced the third state.
  const isFuture = dayDate > today;
  const isPast = dayDate < today;
  const [logging, setLogging] = useState(false);
  const [error, setError] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showIngredients, setShowIngredients] = useState(false);

  const ingredients = meal.ingredients ?? [];

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiFetch(`/api/calories/menu/${menuId}/meals`, {
        method: 'DELETE',
        body: { dayOfWeek, mealType: meal.mealType },
        bodySchema: DeleteMenuMealSchema,
      });
      onDeleted(); // row unmounts on success
    } catch {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  /**
   * Flip the slot's logged state. One function rather than a log/unlog pair: they differed only
   * in the request and the boolean, and the request now lives in `setMealLogged`.
   *
   * Undo matters because a mis-tap is otherwise permanent — the marker is only cleared as a side
   * effect of editing or removing the meal, and both are disabled once the day has passed, which
   * is exactly when you notice the mistake.
   */
  async function toggleLog() {
    setLogging(true);
    setError(false);
    try {
      await setMealLogged(menuId, dayDate, dayOfWeek, meal, !logged);
      onLogChanged(!logged);
    } catch {
      setError(true);
    } finally {
      setLogging(false);
    }
  }

  return (
    <>
      <div
        className={cn(
          'flex flex-col gap-1',
          variant === 'flat'
            ? cn('px-4 py-2.5 border-b border-[var(--border)] last:border-b-0', logged && 'bg-green-500/5')
            : cn(
                'rounded-lg p-2.5 border',
                logged ? 'bg-green-500/5 border-green-500/20' : 'bg-[var(--card)] border-[var(--border)]',
              ),
        )}
      >
        {/* Meal type + buttons on same row */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-wide font-semibold text-[var(--muted)]">
            {MEAL_LABEL[meal.mealType]}
          </span>
          <div className="flex items-center gap-1">
            {/* Editing and removing stop once the day has passed — otherwise an unfollowed meal
                could simply be deleted, and with it the day's share of the adherence denominator.
                Logging deliberately stays available: recording a meal you did eat, late, is the
                one change to a past day that makes the record more accurate rather than less.
                The title sits on the wrapper because a disabled button shows none of its own. */}
            {!logged && (
              <span
                className="flex items-center gap-1"
                title={isPast ? 'Past day — planned meals can no longer be changed' : undefined}
              >
                <IconButton
                  label="Edit this meal"
                  icon={<PencilIcon className="size-3" />}
                  onClick={() => setShowEditor(true)}
                  disabled={isPast}
                  variant="ghost"
                  className="rounded px-1.5 py-0.5 border border-[var(--border)] text-[var(--subtle)] hover:border-[var(--accent)]/50 hover:text-[var(--accent)]"
                />
                <IconButton
                  label="Remove this meal"
                  icon={<TrashOutlineIcon className="size-3" />}
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleting || isPast}
                  variant="ghost"
                  className="rounded px-1.5 py-0.5 border border-[var(--border)] text-[var(--subtle)] hover:border-red-400/50 hover:text-red-400"
                />
              </span>
            )}
            {/* Once logged the same control undoes it, so a mis-tap stays recoverable */}
            {!isFuture && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => void toggleLog()}
                disabled={logging}
                title={logged ? "Undo — I didn't eat this" : 'Log this meal'}
                className={cn(
                  'shrink-0 rounded px-2 py-0.5 text-[10px] font-medium border',
                  logged
                    ? 'border-green-500/30 bg-green-500/10 text-green-400 hover:border-red-400/50 hover:text-red-400'
                    : error
                      ? 'border-red-500/30 bg-red-500/10 text-red-400'
                      : 'border-[var(--border)] text-[var(--subtle)] hover:border-[var(--accent)]/50 hover:text-[var(--accent)]',
                )}
              >
                {logging ? '…' : logged ? '✓ Logged' : 'Log'}
              </Button>
            )}
          </div>
        </div>
        {/* Description + macros below */}
        <span className="text-xs text-[var(--text)] leading-snug">{meal.description}</span>
        {meal.kcal != null && (
          <span className="text-[10px] text-[var(--subtle)]">
            {meal.kcal} kcal
            {meal.protein != null && ` · P ${meal.protein}g`}
            {meal.carbs != null && ` · C ${meal.carbs}g`}
            {meal.fat != null && ` · F ${meal.fat}g`}
          </span>
        )}
        {/* Ingredients stay collapsed by default — a week of expanded lists would bury the plan itself */}
        {ingredients.length > 0 && (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => setShowIngredients(v => !v)}
              aria-expanded={showIngredients}
              className="flex w-fit items-center gap-1 text-[10px] text-[var(--subtle)] hover:text-[var(--accent)] transition-colors"
            >
              <ChevronDownOutlineIcon className={cn('size-3 transition-transform', showIngredients && 'rotate-180')} />
              {ingredients.length} ingredient{ingredients.length === 1 ? '' : 's'}
            </button>
            {showIngredients && (
              <ul className="list-disc pl-4 text-[10px] text-[var(--subtle)] leading-relaxed">
                {ingredients.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <ConfirmModal
          title="Remove meal"
          message={`Remove ${MEAL_LABEL[meal.mealType]} — "${meal.description}"? This cannot be undone.`}
          confirmLabel="Remove"
          confirmVariant="danger"
          loading={deleting}
          onConfirm={() => void handleDelete()}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {showEditor && (
        <MealEditorModal
          mode="edit"
          meal={meal}
          menuId={menuId}
          dayOfWeek={dayOfWeek}
          onClose={() => setShowEditor(false)}
          onSaved={onSwapped}
        />
      )}
    </>
  );
}
