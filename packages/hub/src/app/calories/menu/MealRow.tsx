'use client';

import { useState } from 'react';
import { apiFetch, cn } from '@/lib/utils';
import { Button, IconButton, ConfirmModal } from '@/components';
import { PencilIcon, TrashOutlineIcon } from '@/components/icons';
import type { DayOfWeek } from '@my-hub/shared/constants';
import { DeleteMenuMealSchema, LogDayBodySchema, LogDayResponseSchema } from '@/app/api/calories/menu/menu.schemas';
import { MEAL_LABEL } from '@/app/calories/constants';
import { SwapMealModal } from './SwapMealModal';
import type { WeeklyMenuMeal } from './types';

type MealRowProps = {
  meal: WeeklyMenuMeal;
  menuId: string;
  dayOfWeek: DayOfWeek;
  dayDate: string;
  logged: boolean;
  isFuture: boolean;
  onLogged: () => void;
  onSwapped: (updated: WeeklyMenuMeal) => void;
  onDeleted: () => void;
};

export function MealRow({
  meal,
  menuId,
  dayOfWeek,
  dayDate,
  logged,
  isFuture,
  onLogged,
  onSwapped,
  onDeleted,
}: MealRowProps) {
  const [logging, setLogging] = useState(false);
  const [error, setError] = useState(false);
  const [showSwap, setShowSwap] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  async function handleLog() {
    setLogging(true);
    setError(false);
    try {
      // Single call — the route journals the calorie entry and marks the slot
      // logged in one transaction, so a retry can never duplicate the entry.
      await apiFetch(`/api/calories/menu/${menuId}/log-day`, {
        method: 'POST',
        body: {
          dayOfWeek,
          loggedDate: dayDate,
          mealType: meal.mealType,
          description: meal.description,
          kcal: meal.kcal,
          protein: meal.protein,
          carbs: meal.carbs,
          fat: meal.fat,
        },
        bodySchema: LogDayBodySchema,
        responseSchema: LogDayResponseSchema,
      });
      onLogged();
    } catch {
      setError(true);
    } finally {
      setLogging(false);
    }
  }

  return (
    <>
      <div
        className={`rounded-lg p-2.5 flex flex-col gap-1 ${
          logged ? 'bg-green-500/5 border border-green-500/20' : 'bg-[var(--card)] border border-[var(--border)]'
        }`}
      >
        {/* Meal type + buttons on same row */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-wide font-semibold text-[var(--muted)]">
            {MEAL_LABEL[meal.mealType]}
          </span>
          <div className="flex items-center gap-1">
            {!logged && (
              <IconButton
                label="Edit this meal"
                icon={<PencilIcon className="size-3" />}
                onClick={() => setShowSwap(true)}
                variant="ghost"
                className="rounded px-1.5 py-0.5 border border-[var(--border)] text-[var(--subtle)] hover:border-[var(--accent)]/50 hover:text-[var(--accent)]"
              />
            )}
            {!logged && (
              <IconButton
                label="Remove this meal"
                icon={<TrashOutlineIcon className="size-3" />}
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleting}
                variant="ghost"
                className="rounded px-1.5 py-0.5 border border-[var(--border)] text-[var(--subtle)] hover:border-red-400/50 hover:text-red-400"
              />
            )}
            {!isFuture && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleLog}
                disabled={logged || logging}
                title={logged ? 'Already logged' : 'Log this meal'}
                className={cn(
                  'shrink-0 rounded px-2 py-0.5 text-[10px] font-medium border',
                  logged
                    ? 'border-green-500/30 bg-green-500/10 text-green-400 cursor-default'
                    : error
                      ? 'border-red-500/30 bg-red-500/10 text-red-400'
                      : 'border-[var(--border)] text-[var(--subtle)] hover:border-[var(--accent)]/50 hover:text-[var(--accent)]',
                )}
              >
                {logged ? '✓ Logged' : logging ? '…' : 'Log'}
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

      {showSwap && (
        <SwapMealModal
          meal={meal}
          menuId={menuId}
          dayOfWeek={dayOfWeek}
          dayDate={dayDate}
          onClose={() => setShowSwap(false)}
          onSwapped={updated => {
            onSwapped(updated);
          }}
        />
      )}
    </>
  );
}
