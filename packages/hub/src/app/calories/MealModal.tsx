'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { MealLog } from '@my-hub/shared/types';
import { apiFetch } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Modal, Input } from '@/components';
import { MealTypesValues } from '@my-hub/shared/constants';
import { MEAL_LABEL } from './constants';
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
  onClose: () => void;
  onSaved: () => void;
};

export function MealModal({ date, meal, onClose, onSaved }: MealModalProps) {
  const isEdit = !!meal;

  const form = useForm<MealFormValues>({
    resolver: zodResolver(MealFormSchema),
    defaultValues: meal ? mealToFormValues(meal) : defaultMealFormValues,
  });

  const selectedType = form.watch('mealType');

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
        <FieldCard label="Description *">
          <Input
            {...form.register('description')}
            placeholder="e.g. grilled chicken with rice"
            variant="ghost"
            autoFocus
            className="w-full text-[13px]"
          />
        </FieldCard>

        {/* Meal type — pill toggle like transaction type selector */}
        <div className="flex gap-1.5 rounded-[10px] border border-[var(--border)] bg-[var(--card2)] p-1">
          {MealTypesValues.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => form.setValue('mealType', t)}
              className={cn(
                'flex-1 cursor-pointer rounded-[7px] py-1.5 text-[12px] font-medium capitalize transition-colors',
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
          <FieldCard label="Calories (kcal)">
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
          <FieldCard label="Protein (g)">
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
          <FieldCard label="Carbs (g)">
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
          <FieldCard label="Fat (g)">
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
