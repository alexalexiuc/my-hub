'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { apiFetch } from '@/lib/utils';
import { Modal, Textarea, Input, Field } from '@/components';
import { DAY_LABELS } from '@my-hub/shared/constants';
import type { DayOfWeek } from '@my-hub/shared/constants';
import { MenuMealResponseSchema, MenuMealWriteSchema } from '@/app/api/calories/menu/menu.schemas';
import type { MenuMealRecordSchema } from '@/app/api/calories/menu/menu.schemas';
import { MEAL_LABEL } from '@/app/calories/constants';
import {
  SwapMealFormSchema,
  defaultSwapMealFormValues,
  swapMealFormToBody,
  type SwapMealFormValues,
} from './menu-form.schema';

type Meal = z.infer<typeof MenuMealRecordSchema>;

interface Props {
  meal: Meal;
  menuId: string;
  dayOfWeek: DayOfWeek;
  dayDate: string;
  onClose: () => void;
  onSwapped: (updated: Meal) => void;
}

export function SwapMealModal({ meal, menuId, dayOfWeek, onClose, onSwapped }: Props) {
  const dayLabel = DAY_LABELS[dayOfWeek];
  const mealLabel = MEAL_LABEL[meal.mealType];

  const form = useForm<SwapMealFormValues>({
    resolver: zodResolver(SwapMealFormSchema),
    // Macros prefilled from the current meal — the PATCH clears anything omitted,
    // so a description-only edit must still send the existing values.
    defaultValues: defaultSwapMealFormValues(meal),
  });

  async function handleSubmit(values: SwapMealFormValues) {
    const data = await apiFetch(`/api/calories/menu/${menuId}`, {
      method: 'PATCH',
      body: {
        dayOfWeek,
        mealType: meal.mealType,
        ...swapMealFormToBody(values),
      },
      bodySchema: MenuMealWriteSchema,
      responseSchema: MenuMealResponseSchema,
    });
    onSwapped(data.meal);
    onClose();
  }

  return (
    <Modal
      title="Edit meal"
      onClose={onClose}
      onSubmit={form.handleSubmit(handleSubmit)}
      submitLabel="Save"
      submitDisabled={!form.formState.isValid}
      submitLoading={form.formState.isSubmitting}
      className="md:max-w-sm"
    >
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
        <p className="-mt-2 text-xs text-[var(--muted)]">
          {dayLabel} · {mealLabel}
        </p>

        {/* Current meal */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--muted)] mb-1">Current</p>
          <p className="text-sm text-[var(--subtle)]">{meal.description}</p>
          {meal.kcal != null && <p className="text-[10px] text-[var(--subtle)] mt-0.5">{meal.kcal} kcal</p>}
        </div>

        {/* New meal input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text)]">New meal</label>
          <Textarea
            {...form.register('description')}
            placeholder="e.g. Grilled sea bass with roasted vegetables"
            rows={2}
            className="resize-none text-sm"
          />
          <div className="flex gap-1.5">
            <Field label="kcal" className="flex-1">
              <Input {...form.register('kcal')} inputMode="numeric" placeholder="kcal" className="text-xs" />
            </Field>
            <Field label="Protein g" className="flex-1">
              <Input {...form.register('protein')} inputMode="decimal" placeholder="P g" className="text-xs" />
            </Field>
            <Field label="Carbs g" className="flex-1">
              <Input {...form.register('carbs')} inputMode="decimal" placeholder="C g" className="text-xs" />
            </Field>
            <Field label="Fat g" className="flex-1">
              <Input {...form.register('fat')} inputMode="decimal" placeholder="F g" className="text-xs" />
            </Field>
          </div>
          <p className="text-[10px] text-[var(--subtle)]">
            Calories and macros are prefilled from the current meal — update them to match the new one, or clear a field
            to remove the value.
          </p>
          <p className="text-[10px] text-[var(--subtle)]">
            Or ask Claude:{' '}
            <span className="italic">
              "Change my {dayLabel} {mealLabel.toLowerCase()} to something different"
            </span>{' '}
            — Claude will update it automatically.
          </p>
        </div>
      </form>
    </Modal>
  );
}
