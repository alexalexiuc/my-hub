'use client';

import { useId } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, ColorPicker, Input } from '@/components';
import { randomTripColor } from './trips-sidebar.utils';
import { TripFormSchema, type TripFormValues } from './trip-form.schema';

type TripFormProps = {
  defaultValues?: Partial<TripFormValues>;
  onSubmit: (values: TripFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
  submitClassName?: string;
};

export function TripForm({ defaultValues, onSubmit, onCancel, submitLabel, submitClassName }: TripFormProps) {
  const colorId = useId();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TripFormValues>({
    resolver: zodResolver(TripFormSchema),
    defaultValues: {
      name: '',
      destination: '',
      color: randomTripColor(),
      startAt: '',
      endAt: '',
      ...defaultValues,
    },
  });

  async function handleFormSubmit(values: TripFormValues) {
    await onSubmit(values);
    reset({ name: '', destination: '', color: randomTripColor(), startAt: '', endAt: '' });
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-2">
      <Input {...register('name')} placeholder="Trip name" />
      {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}

      <Input {...register('destination')} placeholder="Destination" />

      <div className="grid grid-cols-2 gap-2">
        <Input type="date" {...register('startAt')} />
        <Input type="date" {...register('endAt')} />
      </div>

      <div className="flex items-center justify-between rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">
        <label htmlFor={colorId} className="text-zinc-300">
          Color
        </label>
        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <ColorPicker id={colorId} value={field.value} onChange={(e) => field.onChange(e.target.value)} />
          )}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="submit" loading={isSubmitting} className={submitClassName}>
          {submitLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
