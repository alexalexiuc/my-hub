'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '@/lib/utils';
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
    <div
      onClick={onClose}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-[var(--fin-overlay)]"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-[14px] border border-[var(--fin-border)] bg-[var(--fin-card)] p-5"
      >
        <div className="mb-4 text-base font-bold text-[var(--fin-text)]">New Goal</div>

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
      </div>
    </div>
  );
}
