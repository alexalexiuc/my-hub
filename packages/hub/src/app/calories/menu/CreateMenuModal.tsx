'use client';

import { useState } from 'react';
import { Modal, Input, Button, Select } from '@/components';
import { PlusOutlineIcon, TrashOutlineIcon, DumbbellIcon } from '@/components/icons';
import { DAY_LABELS, DaysOfWeekValues, MealTypesValues } from '@my-hub/shared/constants';
import type { DayOfWeek, MealType } from '@my-hub/shared/constants';
import { dateToString, omitNullish } from '@my-hub/shared/utils';
import { apiFetch } from '@/lib/utils';
import { CreateMenuSchema, CreateMenuResponseSchema, hasDuplicateMealSlot } from '@/app/api/calories/menu/menu.schemas';
import { MEAL_LABEL } from '@/app/calories/constants';
import { dateForDay, formatWeekLabel, currentWeekMonday, shiftWeek } from './menu.utils';
import type { WeeklyMenu } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MealRow {
  id: string; // local key for React list
  mealType: MealType;
  description: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
}

type DayMeals = Record<DayOfWeek, MealRow[]>;

const MEAL_TYPE_OPTIONS = MealTypesValues.map(t => ({ value: t, label: MEAL_LABEL[t] }));

const MACRO_KEYS = ['kcal', 'protein', 'carbs', 'fat'] as const;
type MacroKey = (typeof MACRO_KEYS)[number];

/** Render metadata for the per-meal macro inputs. */
const MACRO_FIELDS: { key: MacroKey; placeholder: string; width: string }[] = [
  { key: 'kcal', placeholder: 'kcal', width: 'w-16' },
  { key: 'protein', placeholder: 'P g', width: 'w-14' },
  { key: 'carbs', placeholder: 'C g', width: 'w-14' },
  { key: 'fat', placeholder: 'F g', width: 'w-14' },
];

function initialDayMeals(): DayMeals {
  return Object.fromEntries(DaysOfWeekValues.map(d => [d, [makeRow()]])) as DayMeals;
}

function makeRow(mealType: MealType = 'lunch'): MealRow {
  return { id: crypto.randomUUID(), mealType, description: '', kcal: '', protein: '', carbs: '', fat: '' };
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

  function updateRow(day: DayOfWeek, id: string, patch: Partial<Omit<MealRow, 'id'>>) {
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
  ) as Record<DayOfWeek, MealRow[]>;

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
  const hasDayMacros = activeTotals.protein > 0 || activeTotals.carbs > 0 || activeTotals.fat > 0;
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

        {/* Day tabs — past days disabled on current week */}
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {DaysOfWeekValues.map(d => {
            const count = mealCountPerDay[d];
            const isActive = d === activeDay;
            const isPast = dayDates[d] < today;
            const isGymDay = gymDays.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => !isPast && setActiveDay(d)}
                disabled={isPast}
                className={`relative shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                  isActive
                    ? 'bg-[var(--accent)] text-white'
                    : 'border border-[var(--border)] text-[var(--subtle)] hover:text-[var(--text)]'
                }`}
              >
                {DAY_LABELS[d].slice(0, 3)}
                {isGymDay && (
                  <DumbbellIcon className="inline-block ml-0.5 size-3 text-[var(--accent)]" title="Gym day" />
                )}
                {count > 0 && (
                  <span
                    className={`ml-1 rounded-full px-1 text-[10px] font-semibold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-[var(--accent)]/20 text-[var(--accent)]'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {gymDays.length > 0 && (
          <p className="flex items-center gap-1 text-[10px] text-[var(--muted)]">
            <DumbbellIcon className="size-3 text-[var(--accent)]" /> Days marked with this icon are your gym days
          </p>
        )}

        {/* Meal rows for active day */}
        <div className="flex flex-col gap-2 min-h-[120px]">
          {rows.length === 0 && (
            <p className="text-sm text-[var(--muted)] italic">No meals added for {DAY_LABELS[activeDay]} yet.</p>
          )}

          {rows.map(row => (
            <div key={row.id} className="flex flex-col gap-1.5 rounded-lg border border-[var(--border)] p-2">
              {/* Row 1: type + description + remove */}
              <div className="flex gap-2 items-center">
                <div className="w-28 shrink-0">
                  <Select
                    value={row.mealType}
                    onChange={e => updateRow(activeDay, row.id, { mealType: e.target.value as MealType })}
                    options={MEAL_TYPE_OPTIONS}
                    className="text-sm"
                  />
                </div>
                <Input
                  value={row.description}
                  onChange={e => updateRow(activeDay, row.id, { description: e.target.value })}
                  placeholder="e.g. Oats with banana"
                  className="flex-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeRow(activeDay, row.id)}
                  className="text-[var(--muted)] hover:text-red-400 transition-colors shrink-0"
                  aria-label="Remove meal"
                >
                  <TrashOutlineIcon className="w-4 h-4" />
                </button>
              </div>
              {/* Row 2: kcal + macros */}
              <div className="flex gap-1.5">
                {MACRO_FIELDS.map(f => (
                  <Input
                    key={f.key}
                    value={row[f.key]}
                    onChange={e => updateRow(activeDay, row.id, { [f.key]: e.target.value.replace(/\D/g, '') })}
                    placeholder={f.placeholder}
                    className={`${f.width} text-xs`}
                  />
                ))}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between mt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => addRow(activeDay)}
              className="flex items-center"
            >
              <PlusOutlineIcon className="w-4 h-4 mr-1" />
              Add meal
            </Button>
            {activeTotals.kcal > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-[var(--accent)]">{activeTotals.kcal} kcal</span>
                {hasDayMacros && (
                  <span className="text-[var(--muted)]">
                    P {activeTotals.protein}g · C {activeTotals.carbs}g · F {activeTotals.fat}g
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Summary / missing days hint + weekly total */}
        <div className="flex items-start justify-between gap-4">
          <div>
            {duplicateSlotDays.length > 0 && (
              <p className="text-xs text-red-400">
                Duplicate meal types on: {duplicateSlotDays.map(d => DAY_LABELS[d].slice(0, 3)).join(', ')} — each type
                can appear once per day
              </p>
            )}
            {missingDays.length > 0 ? (
              <p className="text-xs text-amber-400">
                Still missing: {missingDays.map(d => DAY_LABELS[d].slice(0, 3)).join(', ')}
              </p>
            ) : duplicateSlotDays.length === 0 && Object.values(mealCountPerDay).some(c => c > 0) ? (
              <p className="text-xs text-green-400">All days have at least one meal ✓</p>
            ) : null}
          </div>
          {weekTotals.kcal > 0 && (
            <div className="flex flex-col items-end gap-0.5 text-xs text-[var(--subtle)] shrink-0">
              <span>Weekly: {weekTotals.kcal} kcal</span>
              {hasWeeklyMacros && (
                <span>
                  P {weekTotals.protein}g · C {weekTotals.carbs}g · F {weekTotals.fat}g
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
