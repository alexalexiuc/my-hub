'use client';

import { useState } from 'react';
import type { MealLog } from '@my-hub/shared/types';
import { apiFetch } from '@/lib/utils';
import { dateToString } from '@my-hub/shared/utils';
import { Card, ConfirmModal, SwipeRow } from '@/components';
import { PencilIcon, TrashOutlineIcon } from '@/components/icons';
import { MealTypesValues } from '@my-hub/shared/constants';
import { MEAL_LABEL } from './constants';
import { groupByMealType } from './calories.utils';
import { MealModal } from './MealModal';

type MealsSectionProps = {
  meals: MealLog[];
  selectedDate: string;
  onChanged: () => void;
};

export function MealsSection({ meals, selectedDate, onChanged }: MealsSectionProps) {
  const today = dateToString(new Date());
  const [editingMeal, setEditingMeal] = useState<MealLog | null>(null);
  const [deletingMeal, setDeletingMeal] = useState<MealLog | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [openRowId, setOpenRowId] = useState<string | null>(null);

  const grouped = groupByMealType(meals);
  const total = meals.reduce((sum, m) => sum + (m.kcal ?? 0), 0);
  const totalProtein = Math.round(meals.reduce((sum, m) => sum + (m.protein ?? 0), 0));
  const totalCarbs = Math.round(meals.reduce((sum, m) => sum + (m.carbs ?? 0), 0));
  const totalFat = Math.round(meals.reduce((sum, m) => sum + (m.fat ?? 0), 0));
  const hasMacros = totalProtein > 0 || totalCarbs > 0 || totalFat > 0;

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
          onClose={() => setEditingMeal(null)}
          onSaved={() => {
            setEditingMeal(null);
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

      <Card className="!p-0 overflow-hidden">
        {/* Meal list */}
        {meals.length === 0 ? (
          <p className="px-5 py-5 text-sm text-[var(--subtle)]">
            No meals logged{selectedDate === today ? ' today' : ''}.
          </p>
        ) : (
          <>
            {MealTypesValues.filter(t => grouped[t]?.length).map(type => (
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

            {/* Totals row */}
            <div className="flex items-center justify-between bg-[var(--card2)] px-5 py-2.5 text-xs">
              <span className="font-semibold text-[var(--text)]">Total</span>
              <div className="flex gap-3 text-[var(--muted)]">
                <span>{total} kcal</span>
                {hasMacros && (
                  <>
                    <span className="text-sky-400/80">P {totalProtein}g</span>
                    <span className="text-amber-400/80">C {totalCarbs}g</span>
                    <span className="text-rose-400/80">F {totalFat}g</span>
                  </>
                )}
              </div>
            </div>
          </>
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
