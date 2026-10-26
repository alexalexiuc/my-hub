'use client';

import { useState } from 'react';
import type { MealLog } from '@my-hub/shared/types';
import { apiFetch } from '@/lib/utils';
import { dateToString, mealOrder, shiftDateStr } from '@my-hub/shared/utils';
import { Button, Card, ConfirmModal, SwipeRow } from '@/components';
import { PencilIcon, PlusOutlineIcon, TrashOutlineIcon } from '@/components/icons';
import type { GymTime } from '@my-hub/shared/constants';
import { MACRO_COLORS, MEAL_LABEL } from './constants';
import { formatDateLabel, groupByMealType, sumMealTotals } from './calories.utils';
import { relogMeals } from './relogMeals';
import { MealModal } from './MealModal';

type MealsSectionProps = {
  meals: MealLog[];
  selectedDate: string;
  /** When the user trains — orders the logged groups the same way every other meal list is ordered. */
  gymTime: GymTime | null;
  onChanged: () => void;
  /** Shows an "Add meal" button for this day — for surfaces without the layout's Add button in reach. */
  showAdd?: boolean;
  /** Renders an inset bordered card at every width — for use inside a modal, where full-bleed would overflow. */
  compact?: boolean;
};

export function MealsSection({
  meals,
  selectedDate,
  gymTime,
  onChanged,
  showAdd = false,
  compact = false,
}: MealsSectionProps) {
  const today = dateToString(new Date());
  const [editingMeal, setEditingMeal] = useState<MealLog | null>(null);
  const [deletingMeal, setDeletingMeal] = useState<MealLog | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copyNote, setCopyNote] = useState<string | null>(null);

  const grouped = groupByMealType(meals);
  const { kcal: total, protein: totalProtein, carbs: totalCarbs, fat: totalFat } = sumMealTotals(meals);
  const hasMacros = totalProtein > 0 || totalCarbs > 0 || totalFat > 0;
  const previousDay = shiftDateStr(selectedDate, -1);

  /**
   * Re-logs everything from the day before onto this one — the quickest fill for the days you
   * eat the same thing. Only offered while this day is empty, so it can't double a day up.
   */
  async function copyPreviousDay() {
    setCopying(true);
    setCopyNote(null);
    try {
      const { meals: previous } = await apiFetch<{ meals: MealLog[] }>('/api/calories/meals', {
        query: { date: previousDay, limit: 100 },
        silentToast: true,
      });
      if (previous.length === 0) {
        setCopyNote(`Nothing logged on ${formatDateLabel(previousDay).toLowerCase()} to copy.`);
        return;
      }
      await relogMeals(previous, selectedDate);
      onChanged();
    } finally {
      setCopying(false);
    }
  }

  async function confirmDelete() {
    if (!deletingMeal?.mealId) return;
    setDeleting(deletingMeal.mealId);
    try {
      await apiFetch(`/api/calories/meals/${deletingMeal.mealId}`, { method: 'DELETE' });
      setDeletingMeal(null);
      onChanged();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      {editingMeal && (
        <MealModal
          date={selectedDate}
          meal={editingMeal}
          gymTime={gymTime}
          onClose={() => setEditingMeal(null)}
          onSaved={() => {
            setEditingMeal(null);
            onChanged();
          }}
        />
      )}

      {adding && (
        <MealModal
          date={selectedDate}
          gymTime={gymTime}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            onChanged();
          }}
        />
      )}

      {deletingMeal && (
        <ConfirmModal
          title="Delete meal"
          message={`Delete "${deletingMeal.description}"?`}
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setDeletingMeal(null)}
          loading={!!deleting}
        />
      )}

      <Card compact={compact} className="!p-0 overflow-hidden">
        {/* Meal list */}
        {meals.length === 0 ? (
          <div className="flex flex-col items-start gap-2 px-5 py-5">
            <p className="text-sm text-[var(--subtle)]">No meals logged{selectedDate === today ? ' today' : ''}.</p>
            <button
              type="button"
              onClick={() => void copyPreviousDay()}
              disabled={copying}
              className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
            >
              {copying ? 'Copying…' : `Copy meals from ${formatDateLabel(previousDay).toLowerCase()}`}
            </button>
            {copyNote && <p className="text-xs text-[var(--subtle)]">{copyNote}</p>}
          </div>
        ) : (
          <>
            {mealOrder(gymTime)
              .filter(t => grouped[t]?.length)
              .map(type => (
                <div key={type} className="border-b border-[var(--border)] last:border-b-0">
                  <div className="px-5 py-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">
                      {MEAL_LABEL[type]}
                    </span>
                  </div>
                  {grouped[type]!.map(meal => (
                    <div key={meal.id}>
                      {/* Mobile: swipe-to-reveal edit/delete */}
                      <div data-layout="mobile" className="md:hidden">
                        <SwipeRow
                          isOpen={openRowId === meal.mealId}
                          onOpen={() => setOpenRowId(meal.mealId ?? null)}
                          onClose={() => setOpenRowId(null)}
                          onEdit={() => setEditingMeal(meal)}
                          onDelete={() => setDeletingMeal(meal)}
                        >
                          <div className="flex items-center gap-3 px-5 py-2.5">
                            <MealRowContent meal={meal} />
                          </div>
                        </SwipeRow>
                      </div>

                      {/* Desktop: hover buttons */}
                      <div
                        data-layout="desktop"
                        className="group hidden items-center justify-between gap-3 px-5 py-2.5 hover:bg-[var(--card2)] md:flex"
                      >
                        <MealRowContent meal={meal} />
                        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => setEditingMeal(meal)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--card3)] hover:text-[var(--accent)]"
                            aria-label="Edit meal"
                          >
                            <PencilIcon className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingMeal(meal)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--card3)] hover:text-[var(--red)]"
                            aria-label="Delete meal"
                          >
                            <TrashOutlineIcon className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}

            {/* Totals row — desktop only: on a phone the calorie card above already says the same.
                No data-layout marker: it has no mobile twin, and the marker scopes the meal rows. */}
            <div className="hidden items-center justify-between bg-[var(--card2)] px-5 py-2.5 text-xs md:flex">
              <span className="font-semibold text-[var(--text)]">Total</span>
              <div className="flex gap-3 text-[var(--muted)]">
                <span>{total} kcal</span>
                {hasMacros && (
                  <>
                    <span style={{ color: MACRO_COLORS.protein }}>P {totalProtein}g</span>
                    <span style={{ color: MACRO_COLORS.carbs }}>C {totalCarbs}g</span>
                    <span style={{ color: MACRO_COLORS.fat }}>F {totalFat}g</span>
                  </>
                )}
              </div>
            </div>
          </>
        )}
        {showAdd && (
          <div className="border-t border-[var(--border)] px-5 py-3">
            <Button variant="ghost" size="sm" onClick={() => setAdding(true)} className="flex items-center gap-1.5">
              <PlusOutlineIcon className="size-3.5" />
              Add meal to this day
            </Button>
          </div>
        )}
      </Card>
    </>
  );
}

function MealRowContent({ meal }: { meal: MealLog }) {
  return (
    <div className="min-w-0 flex-1">
      <span className="text-sm font-medium text-[var(--text)]">{meal.description}</span>
      {meal.kcal ? <span className="ml-2 text-sm text-[var(--muted)]">{meal.kcal} kcal</span> : null}
      {(meal.protein || meal.carbs || meal.fat) && (
        <span className="ml-2 text-xs text-[var(--subtle)]">
          {[
            meal.protein ? `P ${meal.protein}g` : null,
            meal.carbs ? `C ${meal.carbs}g` : null,
            meal.fat ? `F ${meal.fat}g` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      )}
    </div>
  );
}
