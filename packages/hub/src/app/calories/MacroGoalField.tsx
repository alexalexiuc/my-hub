'use client';

import type { UseFormRegisterReturn } from 'react-hook-form';
import { Field, Input } from '@/components';
import { gramsToPct, pctToGrams } from './calories.utils';
import type { MacroMode } from './profile-form.schema';

type MacroGoalFieldProps = {
  /** "Protein", "Carbs" or "Fat". */
  label: string;
  /** 4 for protein and carbs, 9 for fat. */
  kcalPerGram: number;
  /** The field's current text, in grams or percent per `macroMode`. */
  value: string;
  macroMode: MacroMode;
  /** Max calories/day — what a percentage is a share of. Null hides the conversion hint. */
  maxCalNum: number | null;
  registration: UseFormRegisterReturn;
};

/**
 * One daily macro goal, typed in grams or as a % of max calories, with the other unit and the
 * kcal it works out to shown underneath.
 */
export function MacroGoalField({ label, kcalPerGram, value, macroMode, maxCalNum, registration }: MacroGoalFieldProps) {
  const grams = macroMode === '%' && maxCalNum ? Number(pctToGrams(value, kcalPerGram, maxCalNum)) : Number(value);
  return (
    <Field label={macroMode === 'g' ? `${label} (g/day)` : `${label} (%)`}>
      <Input
        type="number"
        step="1"
        min="0"
        max={macroMode === '%' ? 100 : undefined}
        placeholder="Optional"
        {...registration}
      />
      {value && maxCalNum && (
        <p className="text-xs text-[var(--subtle)] mt-0.5">
          ≈ {macroMode === '%' ? `${grams}g` : `${gramsToPct(value, kcalPerGram, maxCalNum)}%`} ·{' '}
          {Math.round(grams * kcalPerGram)} kcal
        </p>
      )}
    </Field>
  );
}
