'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal, Input, ColorPicker } from '@/components';
import { apiFetch } from '@/lib/utils';
import type { ApiTrip } from './types';
import {
  TripFormSchema,
  type TripFormValues,
  tripToFormValues,
  formToCreateBody,
  formToUpdateBody,
} from './trip-form.schema';
import { randomTripColor } from './trips-sidebar.utils';
import { FieldCard } from './ui';
import type { Trip } from '@my-hub/shared/types';

type TripModalProps = {
  editingTrip?: ApiTrip;
  onClose: () => void;
  onSaved: (newTripId?: number) => void;
};

export function TripModal({ editingTrip, onClose, onSaved }: TripModalProps) {
  const isEdit = !!editingTrip;

  const form = useForm<TripFormValues>({
    resolver: zodResolver(TripFormSchema),
    defaultValues: editingTrip
      ? tripToFormValues(editingTrip as unknown as Trip)
      : { name: '', destination: '', color: randomTripColor(), startAt: '', endAt: '' },
  });

  async function handleSubmit(values: TripFormValues) {
    if (isEdit) {
      await apiFetch(`/api/travel/trips/${editingTrip.id}`, {
        method: 'PATCH',
        body: formToUpdateBody(values),
      });
      onSaved();
    } else {
      const result = await apiFetch<{ trip: ApiTrip }>('/api/travel/trips', {
        method: 'POST',
        body: formToCreateBody(values),
      });
      onSaved(result?.trip?.id);
    }
  }

  return (
    <Modal
      title={isEdit ? 'Edit Trip' : 'New Trip'}
      onClose={onClose}
      onSubmit={form.handleSubmit(handleSubmit)}
      submitLabel={isEdit ? 'Save' : 'Create Trip'}
      submitLoading={form.formState.isSubmitting}
      className="md:max-w-[440px]"
    >
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-2.5">
        <FieldCard label="Trip name *">
          <Input
            {...form.register('name')}
            placeholder="e.g. Tokyo 2026"
            variant="ghost"
            autoFocus
            className="w-full text-[13px]"
          />
        </FieldCard>
        {form.formState.errors.name && (
          <p className="text-xs text-[var(--red)]">{form.formState.errors.name.message}</p>
        )}

        <FieldCard label="Destination">
          <Input
            {...form.register('destination')}
            placeholder="e.g. Tokyo, Japan"
            variant="ghost"
            className="w-full text-[13px]"
          />
        </FieldCard>

        <div className="grid grid-cols-2 gap-2.5">
          <FieldCard label="Start date">
            <Input {...form.register('startAt')} type="date" variant="ghost" className="w-full text-[13px]" />
          </FieldCard>
          <FieldCard label="End date">
            <Input {...form.register('endAt')} type="date" variant="ghost" className="w-full text-[13px]" />
          </FieldCard>
        </div>

        <FieldCard label="Color">
          <div className="flex items-center gap-3 py-0.5">
            <Controller
              control={form.control}
              name="color"
              render={({ field }) => <ColorPicker value={field.value} onChange={e => field.onChange(e.target.value)} />}
            />
            <span className="text-[13px] text-[var(--muted)]">Pick a trip colour</span>
          </div>
        </FieldCard>
      </form>
    </Modal>
  );
}
