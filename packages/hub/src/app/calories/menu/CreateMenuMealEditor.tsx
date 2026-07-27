'use client';

import { Input, Button, Select, Textarea } from '@/components';
import { PlusOutlineIcon, TrashOutlineIcon } from '@/components/icons';
import { DAY_LABELS, MealTypesValues } from '@my-hub/shared/constants';
import type { DayOfWeek, MealType } from '@my-hub/shared/constants';
import { INGREDIENT_LINE_HINT } from './menu-form.schema';
import type { MacroKey, MealFormRow } from './menu-form.schema';
import { mealTypeOptions } from './menu.utils';

const MEAL_TYPE_OPTIONS = mealTypeOptions(MealTypesValues);

/** Render metadata for the per-meal macro inputs. */
const MACRO_FIELDS: { key: MacroKey; placeholder: string; width: string }[] = [
  { key: 'kcal', placeholder: 'kcal', width: 'w-16' },
  { key: 'protein', placeholder: 'P g', width: 'w-14' },
  { key: 'carbs', placeholder: 'C g', width: 'w-14' },
  { key: 'fat', placeholder: 'F g', width: 'w-14' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface CreateMenuMealEditorProps {
  activeDay: DayOfWeek;
  rows: MealFormRow[];
  totals: Record<MacroKey, number>;
  onAddRow: () => void;
  onRemoveRow: (id: string) => void;
  onUpdateRow: (id: string, patch: Partial<Omit<MealFormRow, 'id'>>) => void;
}

/** Editable list of meal rows for the active day, plus an add button and the day's macro totals. */
export function CreateMenuMealEditor({
  activeDay,
  rows,
  totals,
  onAddRow,
  onRemoveRow,
  onUpdateRow,
}: CreateMenuMealEditorProps) {
  const hasDayMacros = totals.protein > 0 || totals.carbs > 0 || totals.fat > 0;

  return (
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
                onChange={e => onUpdateRow(row.id, { mealType: e.target.value as MealType })}
                options={MEAL_TYPE_OPTIONS}
                className="text-sm"
              />
            </div>
            <Input
              value={row.description}
              onChange={e => onUpdateRow(row.id, { description: e.target.value })}
              placeholder="e.g. Oats with banana"
              className="flex-1 text-sm"
            />
            <button
              type="button"
              onClick={() => onRemoveRow(row.id)}
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
                onChange={e => onUpdateRow(row.id, { [f.key]: e.target.value.replace(/\D/g, '') })}
                placeholder={f.placeholder}
                className={`${f.width} text-xs`}
              />
            ))}
          </div>
          {/* Row 3: optional ingredients, one per line */}
          <Textarea
            value={row.ingredients}
            onChange={e => onUpdateRow(row.id, { ingredients: e.target.value })}
            placeholder="Ingredients, one per line (optional)"
            rows={2}
            className="resize-none text-xs"
          />
        </div>
      ))}

      {/* Stated once for the whole day rather than under each row — a day can hold up to 7 meals */}
      {rows.length > 0 && <p className="text-[10px] text-[var(--subtle)]">{INGREDIENT_LINE_HINT}</p>}

      <div className="flex items-center justify-between mt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onAddRow} className="flex items-center">
          <PlusOutlineIcon className="w-4 h-4 mr-1" />
          Add meal
        </Button>
        {totals.kcal > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-[var(--accent)]">{totals.kcal} kcal</span>
            {hasDayMacros && (
              <span className="text-[var(--muted)]">
                P {totals.protein}g · C {totals.carbs}g · F {totals.fat}g
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
