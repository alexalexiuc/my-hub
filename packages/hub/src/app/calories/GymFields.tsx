'use client';

import { Controller, type Control, type UseFormRegister } from 'react-hook-form';
import { DaysOfWeekValues, DAY_LABELS_SHORT } from '@my-hub/shared/constants';
import { Field, Input, Select } from '@/components';
import { FIELD_INFO, GYM_TIME_OPTIONS, type ProfileFormValues } from './profile-form.schema';

type GymFieldsProps = {
  control: Control<ProfileFormValues>;
  register: UseFormRegister<ProfileFormValues>;
};

/** The profile form's training section: gym days, the calorie bonus they get, and the time band. */
export function GymFields({ control, register }: GymFieldsProps) {
  return (
    <div>
      <p className="text-xs font-semibold text-[var(--subtle)] uppercase tracking-wide pt-1 pb-1.5">Gym days</p>
      <Controller
        control={control}
        name="gymDays"
        render={({ field }) => (
          <div className="flex gap-1.5 flex-wrap">
            {DaysOfWeekValues.map(value => {
              const active = field.value.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    const next = active
                      ? field.value.filter(d => d !== value)
                      : [...field.value, value].sort((a, b) => a - b);
                    field.onChange(next);
                  }}
                  className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                    active
                      ? 'border-[var(--accent)] bg-[var(--accent-d)] text-[var(--accent)]'
                      : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--muted)]'
                  }`}
                >
                  {DAY_LABELS_SHORT[value]}
                </button>
              );
            })}
          </div>
        )}
      />
      <div className="mt-2 flex flex-wrap gap-3">
        <Field label="Gym day calorie bonus" className="max-w-[160px]" info={FIELD_INFO.gymDayCalorieBonus}>
          <Input type="number" step="any" min="0" placeholder="e.g. 300" {...register('gymDayCalorieBonus')} />
        </Field>
        <Field label="Training time" className="max-w-[160px]" info={FIELD_INFO.gymTime}>
          <Select {...register('gymTime')} options={GYM_TIME_OPTIONS}>
            <option value="">Not set</option>
          </Select>
        </Field>
      </div>
    </div>
  );
}
