'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '@/lib/utils';
import { Modal, Textarea, Input, Select, Field } from '@/components';
import { DAY_LABELS } from '@my-hub/shared/constants';
import type { DayOfWeek, MealType } from '@my-hub/shared/constants';
import { MenuMealResponseSchema, MenuMealWriteSchema } from '@/app/api/calories/menu/menu.schemas';
import { MEAL_LABEL } from '@/app/calories/constants';
import { mealTypeOptions } from './menu.utils';
import {
  INGREDIENT_LINE_HINT,
  MenuMealFormSchema,
  existingMenuMealFormValues,
  menuMealFormToBody,
  newMenuMealFormValues,
  type MenuMealFormValues,
} from './menu-form.schema';
import type { WeeklyMenuMeal } from './types';

type MealEditorModalProps = {
  menuId: string;
  dayOfWeek: DayOfWeek;
  onClose: () => void;
  onSaved: (meal: WeeklyMenuMeal) => void;
} & (
  | { mode: 'edit'; meal: WeeklyMenuMeal }
  // Slots are unique per (day, mealType), so a new meal may only take a type that day still has free.
  | { mode: 'add'; availableTypes: MealType[] }
);

/**
 * The one place a meal's details are authored — both "add to an empty slot" (POST) and
 * "replace the dish in a filled one" (PATCH). Same fields either way; only the meal-type
 * picker, the reference block and the wording differ.
 */
export function MealEditorModal(props: MealEditorModalProps) {
  const { menuId, dayOfWeek, onClose, onSaved } = props;
  const dayLabel = DAY_LABELS[dayOfWeek];

  const form = useForm<MenuMealFormValues>({
    resolver: zodResolver(MenuMealFormSchema),
    defaultValues:
      props.mode === 'edit'
        ? existingMenuMealFormValues(props.meal)
        : newMenuMealFormValues(props.availableTypes[0] ?? 'snack'),
  });

  async function handleSubmit(values: MenuMealFormValues) {
    // Only the endpoint differs — same body, same contracts — so the request is written once.
    const [url, method] =
      props.mode === 'edit'
        ? ([`/api/calories/menu/${menuId}`, 'PATCH'] as const)
        : ([`/api/calories/menu/${menuId}/meals`, 'POST'] as const);

    const data = await apiFetch(url, {
      method,
      body: { dayOfWeek, ...menuMealFormToBody(values) },
      bodySchema: MenuMealWriteSchema,
      responseSchema: MenuMealResponseSchema,
    });

    onSaved(data.meal);
    onClose();
  }

  // The submit reads "Add", not "Add meal": the modal renders inside the day card's DOM, where
  // the trigger button already carries that label — two identical accessible names in one subtree.
  return (
    <Modal
      title={props.mode === 'edit' ? 'Edit meal' : 'Add meal'}
      onClose={onClose}
      onSubmit={form.handleSubmit(handleSubmit)}
      submitLabel={props.mode === 'edit' ? 'Save' : 'Add'}
      submitDisabled={!form.formState.isValid}
      submitLoading={form.formState.isSubmitting}
      className="md:max-w-sm"
    >
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
        <p className="-mt-2 text-xs text-[var(--muted)]">
          {props.mode === 'edit' ? `${dayLabel} · ${MEAL_LABEL[props.meal.mealType]}` : dayLabel}
        </p>

        {/* The dish being replaced, so the user can see what they are editing away from */}
        {props.mode === 'edit' && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--muted)] mb-1">Current</p>
            <p className="text-sm text-[var(--subtle)]">{props.meal.description}</p>
            {props.meal.kcal != null && (
              <p className="text-[10px] text-[var(--subtle)] mt-0.5">{props.meal.kcal} kcal</p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          {/* Editing is slot-addressed, so the meal type is only choosable when adding */}
          {props.mode === 'add' && (
            <Field label="Meal">
              <Select
                {...form.register('mealType')}
                options={mealTypeOptions(props.availableTypes)}
                className="text-sm"
              />
            </Field>
          )}

          <label className="text-xs font-medium text-[var(--text)]">
            {props.mode === 'edit' ? 'New meal' : 'What will you eat?'}
          </label>
          <Textarea
            {...form.register('description')}
            placeholder={props.mode === 'edit' ? 'e.g. Grilled sea bass with roasted vegetables' : 'What will you eat?'}
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

          <Field label="Ingredients (optional)">
            <Textarea
              {...form.register('ingredients')}
              placeholder={'200g chicken breast\n1 red pepper\n1 tbsp olive oil'}
              rows={3}
              className="resize-none text-xs"
            />
          </Field>
          <p className="text-[10px] text-[var(--subtle)]">{INGREDIENT_LINE_HINT}</p>

          {props.mode === 'edit' && (
            <p className="text-[10px] text-[var(--subtle)]">
              Calories, macros and ingredients are prefilled from the current meal — update them to match the new one,
              or clear a field to remove the value.
            </p>
          )}
          <p className="text-[10px] text-[var(--subtle)]">
            Or ask Claude:{' '}
            <span className="italic">
              {props.mode === 'edit'
                ? `"Change my ${dayLabel} ${MEAL_LABEL[props.meal.mealType].toLowerCase()} to something different"`
                : `"Add a ${dayLabel} snack to my menu"`}
            </span>{' '}
            — Claude will update it automatically.
          </p>
        </div>
      </form>
    </Modal>
  );
}
