'use client';

import { useState } from 'react';
import { Modal, Button, DatePicker } from '@/components';
import { ClipboardIcon } from '@/components/icons';
import { DAY_LABELS, DaysOfWeekValues } from '@my-hub/shared/constants';
import type { DayOfWeek } from '@my-hub/shared/constants';
import { dateToString, dayOfWeekMon0, omitNullish, formatWeekRangeStr } from '@my-hub/shared/utils';
import { apiFetch } from '@/lib/utils';
import {
  CreateMenuSchema,
  CreateMenuResponseSchema,
  GetShoppingListResponseSchema,
  hasDuplicateMealSlot,
} from '@/app/api/calories/menu/menu.schemas';
import { dateForDay, currentWeekMonday } from './menu.utils';
import { CreateMenuDayTabs } from './CreateMenuDayTabs';
import { CreateMenuMealEditor } from './CreateMenuMealEditor';
import { MACRO_KEYS, existingMenuMealFormValues, makeRow, parseIngredientLines } from './menu-form.schema';
import type { MealFormRow, MacroKey } from './menu-form.schema';
import type { WeeklyMenu } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DayMeals = Record<DayOfWeek, MealFormRow[]>;

function initialDayMeals(): DayMeals {
  return Object.fromEntries(DaysOfWeekValues.map(d => [d, [makeRow()]])) as DayMeals;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  onClose: () => void;
  onCreated: (menu: WeeklyMenu) => void;
  gymDays?: number[];
  defaultWeekStart?: string;
  /** Weeks that already hold a menu — submitting one of these replaces it rather than adding. */
  existingWeekStarts?: string[];
  /** The menu on screen, offered as a starting point — most weeks resemble the one before them. */
  copyFrom?: WeeklyMenu | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreateMenuModal({
  onClose,
  onCreated,
  gymDays = [],
  defaultWeekStart,
  existingWeekStarts = [],
  copyFrom = null,
}: Props) {
  const thisMonday = currentWeekMonday();
  const [weekStart, setWeekStart] = useState(defaultWeekStart ?? thisMonday);
  const [dayMeals, setDayMeals] = useState<DayMeals>(initialDayMeals);
  const [activeDay, setActiveDay] = useState<DayOfWeek>(dayOfWeekMon0(dateToString()));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<{ title: string | null; notes: string | null; shoppingList: string[] } | null>(
    null,
  );

  /**
   * Fill the form from an existing week. Days already past are skipped: their tabs are disabled,
   * so rows there would be invisible and unremovable. Everything lands as editable rows rather
   * than being submitted directly — the point is a starting draft, not a blind duplicate.
   *
   * The title, prep notes and shopping list come along too: all three describe the meals being
   * copied, so carrying the meals alone would leave the user regenerating things whose content
   * is already correct. The shopping list lives in its own table, hence the extra fetch.
   */
  async function copyMealsFrom(source: WeeklyMenu) {
    const filled = initialDayMeals();
    const today = dateToString();

    for (const meal of source.meals) {
      if (dateForDay(weekStart, meal.dayOfWeek) < today) continue;
      // Reuses the meal→form mapping the edit modal already relies on; only `description` is
      // overridden, because that helper deliberately blanks it for the "replace this dish" flow.
      const row: MealFormRow = {
        id: crypto.randomUUID(),
        ...existingMenuMealFormValues(meal),
        description: meal.description,
      };
      // initialDayMeals seeds one blank row per day; the first copied meal takes its place.
      const existing = filled[meal.dayOfWeek];
      const isSeedRow = existing.length === 1 && !existing[0]?.description;
      filled[meal.dayOfWeek] = isSeedRow ? [row] : [...existing, row];
    }

    setDayMeals(filled);

    // A failed list fetch must not lose the meals that already landed — the copy is still useful
    // without it, so this degrades rather than throws.
    let shoppingList: string[] = [];
    try {
      const data = await apiFetch(`/api/calories/menu/${source.menuId}/shopping-list`, {
        responseSchema: GetShoppingListResponseSchema,
      });
      shoppingList = data.items.map(i => i.text);
    } catch {
      // Losing the list must not lose the meals that already landed.
    }

    setCopied({ title: source.title, notes: source.notes, shoppingList });
  }

  /** What the last copy brought across beyond the meals, which the day tabs already show. */
  const copiedExtras = (() => {
    if (!copied) return null;
    const listCount = copied.shoppingList.length;
    const parts = [
      copied.title ? 'the title' : null,
      copied.notes ? 'prep notes' : null,
      listCount > 0 ? `${listCount} shopping list item${listCount === 1 ? '' : 's'}` : null,
    ].filter(Boolean);
    return parts.length > 0 ? `Also copied: ${parts.join(', ')}.` : null;
  })();

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
  //
  // Days already past contribute nothing, whatever their rows hold. Copying into a future week
  // fills all seven days; stepping back to the current week then leaves those rows in state with
  // their tabs disabled — visible to no one, removable by no one, and otherwise still submitted.
  const filledRowsPerDay = Object.fromEntries(
    DaysOfWeekValues.map(d => [
      d,
      dateForDay(weekStart, d) < dateToString() ? [] : dayMeals[d].filter(r => r.description.trim().length > 0),
    ]),
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
            ingredients: parseIngredientLines(r.ingredients),
            kcal: r.kcal ? parseInt(r.kcal, 10) : undefined,
            protein: r.protein ? parseInt(r.protein, 10) : undefined,
            carbs: r.carbs ? parseInt(r.carbs, 10) : undefined,
            fat: r.fat ? parseInt(r.fat, 10) : undefined,
          }),
        })),
      );

      const data = await apiFetch('/api/calories/menu', {
        method: 'POST',
        // omitNullish so a copy with no title or no notes doesn't send empty strings.
        body: {
          weekStart,
          meals,
          ...omitNullish({
            title: copied?.title ?? undefined,
            notes: copied?.notes ?? undefined,
            shoppingList: copied?.shoppingList.length ? copied.shoppingList : undefined,
          }),
        },
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
  // Reported, not enforced. A day without meals is a legitimate plan — the menu page renders one
  // as "No meals planned", deleting a day's last meal afterwards is allowed, and `calories_plan_week`
  // can write a week with gaps. Blocking here only at creation forbade a state reachable a second
  // later by hand, and it deadlocked "Copy meals from" whenever the source week had an empty day.
  const missingDays = availableDays.filter(d => mealCountPerDay[d] === 0);
  // Each (day, mealType) slot may appear at most once — the DB enforces this with a
  // unique constraint, so surface the conflict here instead of silently collapsing it.
  const duplicateSlotDays = DaysOfWeekValues.filter(d =>
    hasDuplicateMealSlot(filledRowsPerDay[d].map(r => ({ dayOfWeek: d, mealType: r.mealType }))),
  );
  // Mirrors the API's `meals.min(1)`: the only real floor is that the week isn't entirely empty.
  const totalMeals = DaysOfWeekValues.reduce<number>((sum, d) => sum + mealCountPerDay[d], 0);
  const canSubmit = totalMeals > 0 && duplicateSlotDays.length === 0;
  // The API replaces (delete + insert) rather than merges, so submitting over an existing week
  // drops its shopping list and logged-meal markers with it. Say so before, not after.
  const replacesExisting = existingWeekStarts.includes(weekStart);

  return (
    <Modal
      title="Create weekly menu"
      onClose={onClose}
      onSubmit={() => void handleSubmit()}
      submitLabel={replacesExisting ? 'Replace menu' : 'Create menu'}
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
        <DatePicker
          month={weekStart}
          dateMode="week"
          minMonth={thisMonday}
          onChange={({ month: newWeekStart }) => {
            if (!newWeekStart) return;
            setWeekStart(newWeekStart);
            const now = dateToString();
            if (dateForDay(newWeekStart, activeDay) < now) {
              const firstAvailable = DaysOfWeekValues.find(d => dateForDay(newWeekStart, d) >= now);
              if (firstAvailable !== undefined) setActiveDay(firstAvailable);
            }
          }}
          fullBleed={false}
        />

        {/* Offered rather than applied: copying is the common case, but it must not overwrite a
            form the user has already started filling in. Styled as a real button — as quiet muted
            text it was indistinguishable from the hint line below and nobody found it. */}
        {copyFrom && copyFrom.weekStart !== weekStart && copyFrom.meals.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void copyMealsFrom(copyFrom)}
            className="self-start inline-flex items-center gap-2 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-1.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent)]/20"
          >
            <ClipboardIcon className="size-4" />
            Copy meals from {formatWeekRangeStr(copyFrom.weekStart)}
          </Button>
        )}

        {/* Named explicitly — the meals are visible in the tabs, these are not */}
        {copiedExtras && <p className="-mt-1 text-[11px] text-[var(--subtle)]">{copiedExtras}</p>}

        {replacesExisting && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
            {formatWeekRangeStr(weekStart)} already has a menu. Creating one here <strong>replaces</strong> it — its
            shopping list and logged meals are removed too. To change a single meal, close this and use the pencil on
            that meal instead.
          </div>
        )}

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
        {totalMeals === 0 ? (
          <p className="text-xs text-amber-400">Add at least one meal to create the menu</p>
        ) : missingDays.length > 0 ? (
          /* Stated, not enforced — a partly planned week is a normal thing to save. */
          <p className="text-xs text-[var(--subtle)]">
            No meals planned for {missingDays.map(d => DAY_LABELS[d].slice(0, 3)).join(', ')} — you can add them later
          </p>
        ) : duplicateSlotDays.length === 0 ? (
          <p className="text-xs text-green-400">All days have at least one meal ✓</p>
        ) : null}
      </div>
    </Modal>
  );
}
