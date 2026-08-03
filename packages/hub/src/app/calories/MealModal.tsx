'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { MealLog } from '@my-hub/shared/types';
import { apiFetch } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Modal, Input } from '@/components';
import { mealOrder } from '@my-hub/shared/utils';
import type { GymTime } from '@my-hub/shared/constants';
import { MEAL_LABEL } from './constants';
import { useGymTime } from './useGymTime';
import {
  MealFormSchema,
  type MealFormValues,
  defaultMealFormValues,
  mealToFormValues,
  formToAddBody,
  formToUpdateBody,
} from './meals-form.schema';
import { FieldCard } from './ui';

type MealModalProps = {
  date: string;
  meal?: MealLog;
  /** Pass it when the caller already has the profile; omitted, the modal fetches it itself. */
  gymTime?: GymTime | null;
  onClose: () => void;
  onSaved: () => void;
};

export function MealModal({ date, meal, gymTime, onClose, onSaved }: MealModalProps) {
  const isEdit = !!meal;

  const form = useForm<MealFormValues>({
    resolver: zodResolver(MealFormSchema),
    defaultValues: meal ? mealToFormValues(meal) : defaultMealFormValues,
  });

  const selectedType = form.watch('mealType');
  // Surfaced per field: the resolver already refused to submit invalid input, but nothing rendered
  // the reason, so pressing Add on a blank description or a negative calorie count simply did
  // nothing and left the user to guess.
  const { errors } = form.formState;
  // Same ordering rule as the weekly menu's rows and the Today card, so a morning trainer meets
  // pre-workout in the same place everywhere rather than at the end of this one list.
  const mealTypes = mealOrder(useGymTime(gymTime));

  async function handleSubmit(values: MealFormValues) {
    if (isEdit) {
      await apiFetch(`/api/calories/meals/${meal.mealId}`, {
        method: 'PATCH',
        body: formToUpdateBody(values),
      });
    } else {
      await apiFetch('/api/calories/meals', {
        method: 'POST',
        body: formToAddBody(values, date),
      });
    }
    onSaved();
  }

  return (
    <Modal
      title={isEdit ? 'Edit Meal' : 'Add Meal'}
      onClose={onClose}
      onSubmit={form.handleSubmit(handleSubmit)}
      submitLabel={isEdit ? 'Save' : 'Add'}
      submitLoading={form.formState.isSubmitting}
      className="md:max-w-[480px]"
    >
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-2.5">
        <FieldCard label="Description *" error={errors.description?.message}>
          <Input
            {...form.register('description')}
            placeholder="e.g. grilled chicken with rice"
            variant="ghost"
            autoFocus
            className="w-full text-[13px]"
          />
        </FieldCard>

        {/* Meal type — pill toggle like transaction type selector */}
        {/*
          A grid, not a wrapping flex row: seven labels do not fit a phone, and flex stretches the
          second row's items to fill the width, so the two rows never line up. Fixed columns keep
          them aligned. `whitespace-nowrap` because neither flex nor grid wraps a label sensibly —
          "Pre-Workout" breaks at the hyphen, which sent every label to two lines.

          Three columns below 360px, four above, and never seven: a grid column *will* shrink past
          its content (`minmax(0, 1fr)`), so four columns on a 320px screen leave 65px for a label
          needing 76 and "Pre-Workout"/"Post-Workout" run into each other. Seven columns look
          tempting on desktop but the modal is capped at 480px there, which works out at 56px a
          column — narrower than the phone case. Four columns hold at every width above 360.
        */}
        <div className="grid grid-cols-3 gap-1.5 rounded-[10px] border border-[var(--border)] bg-[var(--card2)] p-1 min-[360px]:grid-cols-4">
          {mealTypes.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => form.setValue('mealType', t)}
              className={cn(
                'flex min-h-[44px] cursor-pointer items-center justify-center whitespace-nowrap rounded-[7px] px-2 py-1.5 text-[12px] font-medium capitalize transition-colors',
                selectedType === t
                  ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                  : 'bg-transparent text-[var(--muted)] hover:text-[var(--text)]',
              )}
            >
              {MEAL_LABEL[t]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <FieldCard label="Calories (kcal)" error={errors.kcal?.message}>
            <Input
              {...form.register('kcal')}
              type="number"
              step="1"
              min="0"
              placeholder="0"
              variant="ghost"
              className="w-full text-[13px]"
            />
          </FieldCard>
          <FieldCard label="Protein (g)" error={errors.protein?.message}>
            <Input
              {...form.register('protein')}
              type="number"
              step="0.1"
              min="0"
              placeholder="0"
              variant="ghost"
              className="w-full text-[13px]"
            />
          </FieldCard>
          <FieldCard label="Carbs (g)" error={errors.carbs?.message}>
            <Input
              {...form.register('carbs')}
              type="number"
              step="0.1"
              min="0"
              placeholder="0"
              variant="ghost"
              className="w-full text-[13px]"
            />
          </FieldCard>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <FieldCard label="Fat (g)" error={errors.fat?.message}>
            <Input
              {...form.register('fat')}
              type="number"
              step="0.1"
              min="0"
              placeholder="0"
              variant="ghost"
              className="w-full text-[13px]"
            />
          </FieldCard>
          <FieldCard label="Notes">
            <Input {...form.register('notes')} placeholder="optional" variant="ghost" className="w-full text-[13px]" />
          </FieldCard>
        </div>
      </form>
    </Modal>
  );
}
