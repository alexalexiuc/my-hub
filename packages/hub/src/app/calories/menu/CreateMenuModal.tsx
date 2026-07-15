'use client';

import { useState } from 'react';
import { Modal } from '@/components';
import { DAY_LABELS, DaysOfWeekValues } from '@my-hub/shared/constants';
import type { DayOfWeek } from '@my-hub/shared/constants';
import { dateToString, omitNullish } from '@my-hub/shared/utils';
import { apiFetch } from '@/lib/utils';
import { CreateMenuSchema, CreateMenuResponseSchema, hasDuplicateMealSlot } from '@/app/api/calories/menu/menu.schemas';
import { dateForDay, formatWeekLabel, currentWeekMonday, shiftWeek } from './menu.utils';
import { CreateMenuDayTabs } from './CreateMenuDayTabs';
import { CreateMenuMealEditor, MACRO_KEYS, makeRow } from './CreateMenuMealEditor';
import type { MealFormRow, MacroKey } from './CreateMenuMealEditor';
import type { WeeklyMenu } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DayMeals = Record<DayOfWeek, MealFormRow[]>;

function initialDayMeals(): DayMeals {
  return Object.fromEntries(DaysOfWeekValues.map(d => [d, [makeRow()]])) as DayMeals;
}

/** Returns today's day of week as DayOfWeek (0=Mon … 6=Sun). */
function todayDayOfWeek(): DayOfWeek {
  const jsDay = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  return ((jsDay === 0 ? 7 : jsDay) - 1) as DayOfWeek; // convert to 0=Mon … 6=Sun
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  onClose: () => void;
  onCreated: (menu: WeeklyMenu) => void;
  gymDays?: number[];
  defaultWeekStart?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreateMenuModal({ onClose, onCreated, gymDays = [], defaultWeekStart }: Props) {
  const thisMonday = currentWeekMonday();
  const [weekStart, setWeekStart] = useState(defaultWeekStart ?? thisMonday);
  const [dayMeals, setDayMeals] = useState<DayMeals>(initialDayMeals);
  const [activeDay, setActiveDay] = useState<DayOfWeek>(todayDayOfWeek());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Meal row helpers
  // ---------------------------------------------------------------------------

  function addRow(day: DayOfWeek) {
    setDayMeals(prev => ({ ...prev, [day]: [...prev[day], makeRow()] }));
  }

  function removeRow(day: DayOfWeek, id: string) {
    setDayMeals(prev => ({ ...prev, [day]: prev[day].filter(r => r.id !== id) }));
  }

  function updateRow(day: DayOfWeek, id: string, patch: Partial<Omit<MealFormRow, 'id'>>) {
    setDayMeals(prev => ({
      ...prev,
      [day]: prev[day].map(r => (r.id === id ? { ...r, ...patch } : r)),
    }));
  }

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  // Rows with a non-empty description, per day — the single source of truth for "what actually
  // gets submitted", reused by the meal count, the duplicate-slot check, and the submit payload
  // so all three can never disagree about what counts as a filled row.
  const filledRowsPerDay = Object.fromEntries(
    DaysOfWeekValues.map(d => [d, dayMeals[d].filter(r => r.description.trim().length > 0)]),
  ) as Record<DayOfWeek, MealFormRow[]>;

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const meals = DaysOfWeekValues.flatMap(d =>
        filledRowsPerDay[d].map(r => ({
          dayOfWeek: d,
          mealType: r.mealType,
          description: r.description.trim(),
          ...omitNullish({
            kcal: r.kcal ? parseInt(r.kcal, 10) : undefined,
            protein: r.protein ? parseInt(r.protein, 10) : undefined,
            carbs: r.carbs ? parseInt(r.carbs, 10) : undefined,
            fat: r.fat ? parseInt(r.fat, 10) : undefined,
          }),
        })),
      );

      const data = await apiFetch('/api/calories/menu', {
        method: 'POST',
        body: { weekStart, meals },
        bodySchema: CreateMenuSchema,
        responseSchema: CreateMenuResponseSchema,
      });

      onCreated(data.menu);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create menu');
    } finally {
      setSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const rows = dayMeals[activeDay];
  const mealCountPerDay = Object.fromEntries(DaysOfWeekValues.map(d => [d, filledRowsPerDay[d].length])) as Record<
    DayOfWeek,
    number
  >;

  const toNum = (s: string) => (s ? parseInt(s, 10) : 0);
  const zeroTotals = (): Record<MacroKey, number> => ({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  // Sum all macros for a day in a single pass over its rows.
  const dayTotals = (day: DayOfWeek): Record<MacroKey, number> =>
    dayMeals[day].reduce((acc, r) => {
      for (const k of MACRO_KEYS) acc[k] += toNum(r[k]);
      return acc;
    }, zeroTotals());

  const activeTotals = dayTotals(activeDay);
  const weekTotals = DaysOfWeekValues.reduce<Record<MacroKey, number>>((acc, d) => {
    const t = dayTotals(d);
    for (const k of MACRO_KEYS) acc[k] += t[k];
    return acc;
  }, zeroTotals());
  const hasWeeklyMacros = weekTotals.protein > 0 || weekTotals.carbs > 0 || weekTotals.fat > 0;

  const today = dateToString();
  // Each day's calendar date (depends only on weekStart) — computed once and reused below.
  const dayDates = Object.fromEntries(DaysOfWeekValues.map(d => [d, dateForDay(weekStart, d)])) as Record<
    DayOfWeek,
    string
  >;
  // All available days (days strictly before today are excluded regardless of week)
  const availableDays = DaysOfWeekValues.filter(d => dayDates[d] >= today);
  const missingDays = availableDays.filter(d => mealCountPerDay[d] === 0);
  // Each (day, mealType) slot may appear at most once — the DB enforces this with a
  // unique constraint, so surface the conflict here instead of silently collapsing it.
  const duplicateSlotDays = DaysOfWeekValues.filter(d =>
    hasDuplicateMealSlot(filledRowsPerDay[d].map(r => ({ dayOfWeek: d, mealType: r.mealType }))),
  );
  const canSubmit = missingDays.length === 0 && duplicateSlotDays.length === 0;

  return (
    <Modal
      title="Create weekly menu"
      onClose={onClose}
      onSubmit={() => void handleSubmit()}
      submitLabel="Create menu"
      submitDisabled={!canSubmit}
      submitLoading={submitting}
      className="md:max-w-2xl"
      scrollable={false}
    >
      <div className="flex flex-col gap-4 overflow-y-auto p-4 md:p-6 flex-1">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Week selector — current week and future only */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const prev = shiftWeek(weekStart, -1);
              setWeekStart(prev);
              const now = dateToString();
              if (dateForDay(prev, activeDay) < now) {
                const firstAvailable = DaysOfWeekValues.find(d => dateForDay(prev, d) >= now);
                if (firstAvailable !== undefined) setActiveDay(firstAvailable);
              }
            }}
            disabled={weekStart <= thisMonday}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--subtle)] hover:text-[var(--text)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ‹
          </button>
          <div className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-center text-sm font-medium text-[var(--text)]">
            {formatWeekLabel(weekStart, true)}
          </div>
          <button
            type="button"
            onClick={() => setWeekStart(w => shiftWeek(w, 1))}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--subtle)] hover:text-[var(--text)] transition-colors"
          >
            ›
          </button>
        </div>

        <CreateMenuDayTabs
          activeDay={activeDay}
          onSelectDay={setActiveDay}
          mealCountPerDay={mealCountPerDay}
          dayDates={dayDates}
          today={today}
          gymDays={gymDays}
        />

        <CreateMenuMealEditor
          activeDay={activeDay}
          rows={rows}
          totals={activeTotals}
          onAddRow={() => addRow(activeDay)}
          onRemoveRow={id => removeRow(activeDay, id)}
          onUpdateRow={(id, patch) => updateRow(activeDay, id, patch)}
        />

        {weekTotals.kcal > 0 && (
          <div className="flex flex-col items-end gap-0.5 text-xs text-[var(--subtle)] shrink-0 self-end">
            <span>Weekly: {weekTotals.kcal} kcal</span>
            {hasWeeklyMacros && (
              <span>
                P {weekTotals.protein}g · C {weekTotals.carbs}g · F {weekTotals.fat}g
              </span>
            )}
          </div>
        )}
      </div>

      {/* Validation summary — always visible above the footer regardless of scroll position */}
      <div className="shrink-0 px-4 pb-2 md:px-6">
        {duplicateSlotDays.length > 0 && (
          <p className="text-xs text-red-400">
            Duplicate meal types on: {duplicateSlotDays.map(d => DAY_LABELS[d].slice(0, 3)).join(', ')} — each type can
            appear once per day
          </p>
        )}
        {missingDays.length > 0 ? (
          <p className="text-xs text-amber-400">
            Add at least one meal for: {missingDays.map(d => DAY_LABELS[d].slice(0, 3)).join(', ')}
          </p>
        ) : duplicateSlotDays.length === 0 && Object.values(mealCountPerDay).some(c => c > 0) ? (
          <p className="text-xs text-green-400">All days have at least one meal ✓</p>
        ) : null}
      </div>
    </Modal>
  );
}
