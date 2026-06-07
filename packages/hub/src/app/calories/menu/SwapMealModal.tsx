'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { apiFetch } from '@/lib/utils';
import { Modal, Textarea } from '@/components';
import { DAY_LABELS } from '@my-hub/shared/constants';
import type { DayOfWeek } from '@my-hub/shared/constants';
import { MenuMealResponseSchema, MenuMealWriteSchema } from '@/app/api/calories/menu/menu.schemas';
import type { MenuMealRecordSchema } from '@/app/api/calories/menu/menu.schemas';
import { MEAL_LABEL } from '@/app/calories/constants';
import { SwapMealFormSchema, defaultSwapMealFormValues, type SwapMealFormValues } from './menu-form.schema';

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
    defaultValues: defaultSwapMealFormValues,
  });

  async function handleSubmit(values: SwapMealFormValues) {
    const data = await apiFetch(`/api/calories/menu/${menuId}`, {
      method: 'PATCH',
      body: {
        dayOfWeek,
        mealType: meal.mealType,
        description: values.description.trim(),
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
