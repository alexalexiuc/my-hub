'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '@/lib/utils';
import { FinModalShell } from '../FinModalShell';
import { Button, Field, Input } from '@/components';
import { AddGoalSchema, defaultAddGoalValues, formToGoalBody, type AddGoalValues } from '../finances-form.schema';

type AddGoalModalProps = {
  defaultCurrency: string;
  onClose: () => void;
  onCreated: () => void;
};

export function AddGoalModal({ defaultCurrency, onClose, onCreated }: AddGoalModalProps) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<AddGoalValues>({
    resolver: zodResolver(AddGoalSchema),
    defaultValues: defaultAddGoalValues,
  });

  async function onSubmit(values: AddGoalValues) {
    await apiFetch('/api/finances/accounts', {
      method: 'POST',
      body: { ...formToGoalBody(values), currency: defaultCurrency },
    });
    onCreated();
  }

  return (
    <FinModalShell onClose={onClose} title="New Goal" className="md:max-w-[420px]">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <Field label="Goal Name">
          <Input {...register('name')} placeholder="e.g. Emergency Fund" autoFocus />
        </Field>

        <Field label="Target Amount">
          <Input {...register('targetAmount')} type="number" step="0.01" min="0" placeholder="10000" />
        </Field>

        <Field label="Current Savings">
          <Input {...register('openingBalance')} type="number" step="0.01" min="0" placeholder="0" />
        </Field>

        <div className="mt-1 flex gap-2">
          <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" className="flex-[2]" loading={isSubmitting}>
            Create Goal
          </Button>
        </div>
      </form>
    </FinModalShell>
  );
}
